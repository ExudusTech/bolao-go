import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Send, Trash2, Bell } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Message {
  id: string;
  autor_nome: string;
  autor_gestor_id: string | null;
  conteudo: string;
  created_at: string;
}

interface MessagesPanelProps {
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

export function MessagesPanel({ 
  bolaoId, 
  isGestor = false, 
  participantToken,
  participantApelido 
}: MessagesPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
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
    if (newCount > 0 && !isExpanded) {
      setUnreadCount(prev => prev + newCount);
      playNotificationSound();
    }
    lastMessageCountRef.current = newMessages.length;
  }, [isExpanded]);

  useEffect(() => {
    fetchMessages();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`mensagens-${bolaoId}`)
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
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function fetchMessages() {
    // Only select non-sensitive fields - exclude autor_celular to protect PII
    const { data, error } = await supabase
      .from('mensagens')
      .select('id, bolao_id, autor_nome, autor_gestor_id, conteudo, created_at')
      .eq('bolao_id', bolaoId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return;
    }

    // Map to Message type, setting autor_celular to null since we don't fetch it
    const newMessages: Message[] = (data || []).map(msg => ({
      ...msg,
      autor_celular: null
    }));
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

        // Use RPC function for authenticated participant message
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
    if (!isGestor) return;

    try {
      const { error } = await supabase
        .from('mensagens')
        .delete()
        .eq('id', messageId);

      if (error) throw error;
      toast.success("Mensagem excluída");
    } catch (error: any) {
      console.error('Error deleting message:', error);
      toast.error("Erro ao excluir mensagem");
    }
  }

  const handleExpand = () => {
    setIsExpanded(true);
    setUnreadCount(0);
  };

  const handleCollapse = () => {
    setIsExpanded(false);
  };

  return (
    <Card>
      <CardHeader 
        className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg"
        onClick={isExpanded ? handleCollapse : handleExpand}
      >
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Mensagens do Bolão
            {unreadCount > 0 && (
              <Badge variant="destructive" className="animate-pulse flex items-center gap-1">
                <Bell className="h-3 w-3" />
                {unreadCount} {unreadCount === 1 ? 'nova' : 'novas'}
              </Badge>
            )}
          </div>
          <span className="text-sm font-normal text-muted-foreground">
            {isExpanded ? 'Clique para minimizar' : 'Clique para expandir'}
          </span>
        </CardTitle>
      </CardHeader>
      {isExpanded && (
      <CardContent className="space-y-4">
        <ScrollArea className="h-[300px] pr-4" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Nenhuma mensagem ainda. Seja o primeiro a escrever!
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
                    className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 ${
                        isFromGestor
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium">
                          {isFromGestor ? '👑 Gestor' : msg.autor_nome}
                        </span>
                        {isGestor && !isFromGestor && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 hover:bg-destructive hover:text-destructive-foreground"
                            onClick={() => handleDeleteMessage(msg.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{msg.conteudo}</p>
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

        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Digite sua mensagem..."
            disabled={sending || (!isGestor && !participantToken)}
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
          <p className="text-xs text-muted-foreground text-center">
            Faça login para enviar mensagens
          </p>
        )}
      </CardContent>
      )}
    </Card>
  );
}
