import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Message {
  id: string;
  autor_nome: string;
  autor_celular: string | null;
  autor_gestor_id: string | null;
  conteudo: string;
  created_at: string;
}

interface MessagesPanelProps {
  bolaoId: string;
  isGestor?: boolean;
  participanteName?: string;
  participanteCelular?: string;
}

export function MessagesPanel({ 
  bolaoId, 
  isGestor = false, 
  participanteName,
  participanteCelular 
}: MessagesPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
    const { data, error } = await supabase
      .from('mensagens')
      .select('*')
      .eq('bolao_id', bolaoId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return;
    }

    setMessages(data || []);
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
        if (!participanteName || !participanteCelular) {
          toast.error("Identifique-se antes de enviar mensagens");
          return;
        }

        const { error } = await supabase
          .from('mensagens')
          .insert({
            bolao_id: bolaoId,
            autor_nome: participanteName,
            autor_celular: participanteCelular,
            conteudo: newMessage.trim()
          });

        if (error) throw error;
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageCircle className="h-5 w-5" />
          Mensagens do Bolão
        </CardTitle>
      </CardHeader>
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
                  : msg.autor_celular === participanteCelular;

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
            disabled={sending || (!isGestor && (!participanteName || !participanteCelular))}
          />
          <Button 
            type="submit" 
            size="icon" 
            disabled={sending || !newMessage.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>

        {!isGestor && (!participanteName || !participanteCelular) && (
          <p className="text-xs text-muted-foreground text-center">
            Faça uma aposta para poder enviar mensagens
          </p>
        )}
      </CardContent>
    </Card>
  );
}
