import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LockKeyhole } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const [key, setKey] = useState("");
  const { login } = useAuth();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!key.trim()) return;
    const success = login(key);
    if (success) {
      window.location.href = "/";
    } else {
      toast.error("Chiave di accesso errata.");
      setKey("");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-card rounded-2xl border border-border shadow-xl p-8 space-y-6">
        <div className="text-center space-y-2">
          <img src="/logo.png" alt="Apollo Events" className="w-24 h-24 object-contain mx-auto mb-2 drop-shadow-md" />
          <h1 className="text-2xl font-extrabold tracking-tight">Apollo Events</h1>
          <p className="text-sm text-muted-foreground">Area Protetta</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="relative">
              <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="password"
                placeholder="Chiave di Accesso"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="pl-10 h-12 text-center text-lg tracking-widest rounded-xl"
                autoFocus
              />
            </div>
          </div>
          <Button type="submit" className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg">
            Sblocca App
          </Button>
        </form>
      </div>
    </div>
  );
}
