import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, Send, Trash2, Bell, Pencil, X, Minimize2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  autor_nome: string;
  autor_gestor_id: string | null;
  conteudo: string;
  created_at: string;
}

interface FloatingMessagesPanelProps {
  bolaoId: string;
  isGestor?: boolean;
  participantToken?: string;
  participantApelido?: string;
}

// Audio notification (simple beep)
const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.1;
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.15);
  } catch (e) {
    // Audio not supported or blocked
  }
};

export function FloatingMessagesPanel({ 
  bolaoId, 
  isGestor = false, 
  participantToken,
  participantApelido 
}: FloatingMessagesPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMessageCountRef = useRef(0);
  const isFirstLoadRef = useRef(true);

  const handleNewMessages = useCallback((newMessages: Message[]) => {
    if (isFirstLoadRef.current) {
      isFirstLoadRef.current = false;
      lastMessageCountRef.current = newMessages.length;
      return;
    }

    const newCount = newMessages.length - lastMessageCountRef.current;
    if (newCount > 0 && !isOpen) {
      setUnreadCount(prev => prev + newCount);
      playNotificationSound();
    }
    lastMessageCountRef.current = newMessages.length;
  }, [isOpen]);

  useEffect(() => {
    fetchMessages();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`mensagens-floating-${bolaoId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mensagens',
          filter: `bolao_id=eq.${bolaoId}`
        },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bolaoId]);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  async function fetchMessages() {
    let newMessages: Message[] = [];

    if (isGestor) {
      const { data, error } = await supabase
        .from('mensagens')
        .select('id, bolao_id, autor_nome, autor_gestor_id, conteudo, created_at')
        .eq('bolao_id', bolaoId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        return;
      }

      newMessages = (data || []).map(msg => ({
        ...msg,
        autor_celular: null
      }));
    } else if (participantToken) {
      const { data, error } = await supabase.rpc('get_bolao_messages', {
        p_bolao_id: bolaoId,
        p_token: participantToken
      });

      if (error) {
        console.error('Error fetching messages via RPC:', error);
        return;
      }

      const result = data as unknown as { success: boolean; messages?: Message[]; error?: string };
      if (result?.success && result.messages) {
        newMessages = result.messages;
      }
    }

    handleNewMessages(newMessages);
    setMessages(newMessages);
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    
    if (!newMessage.trim()) return;

    setSending(true);

    try {
      if (isGestor) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          toast.error("Você precisa estar logado para enviar mensagens");
          return;
        }

        const { error } = await supabase
          .from('mensagens')
          .insert({
            bolao_id: bolaoId,
            autor_nome: "Gestor",
            autor_gestor_id: user.id,
            conteudo: newMessage.trim()
          });

        if (error) throw error;
      } else {
        if (!participantToken) {
          toast.error("Faça login para enviar mensagens");
          return;
        }

        const { data, error } = await supabase.rpc("send_participant_message", {
          p_bolao_id: bolaoId,
          p_token: participantToken,
          p_content: newMessage.trim()
        });

        if (error) throw error;
        
        const result = data as { success: boolean; error?: string };
        if (!result.success) {
          toast.error(result.error || "Erro ao enviar mensagem");
          return;
        }
      }

      setNewMessage("");
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error("Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  }

  async function handleDeleteMessage(messageId: string) {
    try {
      if (isGestor) {
        const { error } = await supabase
          .from('mensagens')
          .delete()
          .eq('id', messageId);

        if (error) throw error;
      } else if (participantToken) {
        const { data, error } = await supabase.rpc('delete_participant_message', {
          p_bolao_id: bolaoId,
          p_token: participantToken,
          p_message_id: messageId
        });

        if (error) throw error;
        
        const result = data as { success: boolean; error?: string };
        if (!result.success) {
          toast.error(result.error || "Erro ao excluir mensagem");
          return;
        }
      }
      toast.success("Mensagem excluída");
      fetchMessages();
    } catch (error: any) {
      console.error('Error deleting message:', error);
      toast.error("Erro ao excluir mensagem");
    }
  }

  async function handleEditMessage(message: Message) {
    setEditingMessage(message);
    setEditContent(message.conteudo);
    setIsEditDialogOpen(true);
  }

  async function handleUpdateMessage() {
    if (!editingMessage || !editContent.trim()) return;
    
    setIsUpdating(true);
    try {
      if (isGestor) {
        const { error } = await supabase
          .from('mensagens')
          .update({ conteudo: editContent.trim() })
          .eq('id', editingMessage.id);

        if (error) throw error;
      } else if (participantToken) {
        const { data, error } = await supabase.rpc('update_participant_message', {
          p_bolao_id: bolaoId,
          p_token: participantToken,
          p_message_id: editingMessage.id,
          p_content: editContent.trim()
        });

        if (error) throw error;
        
        const result = data as { success: boolean; error?: string };
        if (!result.success) {
          toast.error(result.error || "Erro ao editar mensagem");
          return;
        }
      }
      toast.success("Mensagem atualizada");
      setIsEditDialogOpen(false);
      setEditingMessage(null);
      setEditContent("");
      fetchMessages();
    } catch (error: any) {
      console.error('Error updating message:', error);
      toast.error("Erro ao editar mensagem");
    } finally {
      setIsUpdating(false);
    }
  }

  const handleOpen = () => {
    setIsOpen(true);
    setUnreadCount(0);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <>
      {/* Floating Button */}
      <div className="fixed bottom-6 right-6 z-50">
        {!isOpen && (
          <Button
            onClick={handleOpen}
            size="lg"
            className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 bg-primary text-primary-foreground"
          >
            <MessageCircle className="h-6 w-6" />
            {unreadCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-2 -right-2 h-6 min-w-6 flex items-center justify-center animate-pulse text-xs font-bold"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </Button>
        )}

        {/* Chat Panel */}
        {isOpen && (
          <Card className="w-[360px] sm:w-[400px] h-[500px] shadow-2xl animate-scale-in flex flex-col">
            <CardHeader className="pb-3 border-b bg-primary text-primary-foreground rounded-t-lg">
              <CardTitle className="flex items-center justify-between text-lg">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  <span>Mensagens</span>
                  <Badge variant="secondary" className="text-xs">
                    {messages.length}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-primary-foreground/20 text-primary-foreground"
                    onClick={handleClose}
                  >
                    <Minimize2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            
            <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
              <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    Nenhuma mensagem ainda. Seja o primeiro!
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg) => {
                      const isFromGestor = !!msg.autor_gestor_id;
                      const isOwnMessage = isGestor 
                        ? isFromGestor 
                        : msg.autor_nome === participantApelido;

                      return (
                        <div
                          key={msg.id}
                          className={cn(
                            "flex flex-col",
                            isOwnMessage ? "items-end" : "items-start"
                          )}
                        >
                          <div
                            className={cn(
                              "max-w-[85%] rounded-lg px-3 py-2",
                              isFromGestor
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            )}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium">
                                {isFromGestor ? '👑 Gestor' : msg.autor_nome}
                              </span>
                              {isOwnMessage && !isFromGestor && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-4 w-4 hover:bg-accent"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditMessage(msg);
                                    }}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-4 w-4 hover:bg-destructive hover:text-destructive-foreground"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteMessage(msg.id);
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                              {isGestor && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-4 w-4 hover:bg-destructive hover:text-destructive-foreground"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteMessage(msg.id);
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                            <p className="text-sm whitespace-pre-wrap break-words">{msg.conteudo}</p>
                            <span className="text-xs opacity-70 mt-1 block">
                              {format(new Date(msg.created_at), "dd/MM HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>

              <div className="p-3 border-t bg-background">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Digite sua mensagem..."
                    disabled={sending || (!isGestor && !participantToken)}
                    className="flex-1"
                  />
                  <Button 
                    type="submit" 
                    size="icon" 
                    disabled={sending || !newMessage.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>

                {!isGestor && !participantToken && (
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    Faça login para enviar mensagens
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Message Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Mensagem</DialogTitle>
          </DialogHeader>
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            placeholder="Digite sua mensagem..."
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateMessage} disabled={isUpdating || !editContent.trim()}>
              {isUpdating ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
