"use client";

import { createClient } from "@/lib/supabase/client";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useRouter } from "next/navigation";

type LogoutButtonProps = Omit<ButtonProps, "onClick" | "type">;

export function LogoutButton(props: LogoutButtonProps) {
  const router = useRouter();

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  return (
    <Button type="button" onClick={logout} {...props}>
      Logout
    </Button>
  );
}
