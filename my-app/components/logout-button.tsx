"use client";

import { createClient } from "@/lib/supabase/client";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import type { MouseEventHandler } from "react";

type LogoutButtonProps = Omit<ButtonProps, "type">;

export function LogoutButton({
  children = "Log out",
  onClick,
  ...props
}: LogoutButtonProps) {
  const router = useRouter();

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/auth/login");
    router.refresh();
  };

  const handleClick: MouseEventHandler<HTMLButtonElement> = async (event) => {
    onClick?.(event);

    if (event.defaultPrevented) {
      return;
    }

    await logout();
  };

  return (
    <Button type="button" onClick={handleClick} {...props}>
      {children}
    </Button>
  );
}
