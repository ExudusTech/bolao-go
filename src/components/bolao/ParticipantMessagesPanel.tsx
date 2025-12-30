import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Send, Bell } from "lucide-react";
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

interface ParticipantMessagesPanelProps {
  bolaoId: string;
  participantApelido: string;
  participantToken: string;
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

export function ParticipantMessagesPanel({ 
  bolaoId, 
  participantApelido,
  participantToken
}: ParticipantMessagesPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isExpanded, setIsExpanded] = useState(true);
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
    if (newCount > 0) {
      // Check if the new message is not from the current participant
      const latestMessages = newMessages.slice(-newCount);
      const hasMessagesFromOthers = latestMessages.some(
        msg => msg.autor_nome.toLowerCase() !== participantApelido.toLowerCase()
      );
      
      if (hasMessagesFromOthers) {
        if (!isExpanded) {
          setUnreadCount(prev => prev + newCount);
        }
        playNotificationSound();
        toast.info("Nova mensagem no bolão!", {
          description: `${latestMessages[latestMessages.length - 1]?.autor_nome || 'Alguém'} enviou uma mensagem`,
          duration: 5000,
        });
      }
    }
    lastMessageCountRef.current = newMessages.length;
  }, [isExpanded, participantApelido]);

  useEffect(() => {
    fetchMessages();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`mensagens-participante-${bolaoId}`)
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
    const { data, error } = await supabase.rpc('get_bolao_messages_public' as any, {
      p_bolao_id: bolaoId
    });

    if (error) {
      console.error('Error fetching messages:', error);
      return;
    }

    const result = data as unknown as { success: boolean; messages?: Message[] };
    if (result?.success && result.messages) {
      handleNewMessages(result.messages);
      setMessages(result.messages);
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    
    if (!newMessage.trim() || !participantToken) {
      toast.error("Você precisa estar autenticado para enviar mensagens");
      return;
    }

    setSending(true);

    try {
      const { data, error } = await supabase.rpc('send_participant_message', {
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

      setNewMessage("");
      fetchMessages();
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error("Erro ao enviar mensagem");
    } finally {
      setSending(false);
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
    <Card className={unreadCount > 0 ? "ring-2 ring-primary animate-pulse" : ""}>
      <CardHeader 
        className={`pb-3 cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg ${
          unreadCount > 0 ? "bg-primary/10" : ""
        }`}
        onClick={isExpanded ? handleCollapse : handleExpand}
      >
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            <MessageCircle className={`h-5 w-5 ${unreadCount > 0 ? "text-primary" : ""}`} />
            Mensagens do Bolão
            {unreadCount > 0 && (
              <Badge variant="destructive" className="animate-bounce flex items-center gap-1">
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
                const isOwnMessage = msg.autor_nome.toLowerCase() === participantApelido.toLowerCase();

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 ${
                        isFromGestor
                          ? 'bg-primary text-primary-foreground'
                          : isOwnMessage
                          ? 'bg-success/20 border border-success/30'
                          : 'bg-muted'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium">
                          {isFromGestor ? '👑 Gestor' : msg.autor_nome}
                          {isOwnMessage && !isFromGestor && ' (você)'}
                        </span>
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
            disabled={sending}
          />
          <Button 
            type="submit" 
            size="icon" 
            disabled={sending || !newMessage.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
      )}
    </Card>
  );
}
