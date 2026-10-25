"use client";

import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { controlFocusClassName, controlTransitionClassName } from "@/components/ui/control-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { loginWithEmail } from "./client";

const SAVED_EMAIL_KEY = "gestao-projetos.saved-email";
const SAVED_PASSWORD_KEY = "gestao-projetos.saved-password";

const loginFieldClassName = cn(
  "h-12 rounded-lg border-input bg-background shadow-none disabled:border-input disabled:bg-background disabled:opacity-100",
  controlTransitionClassName,
  controlFocusClassName,
);

type FieldErrors = {
  email?: string;
  password?: string;
};

function validate(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  const trimmedEmail = email.trim();

  if (!trimmedEmail) {
    errors.email = "Informe o e-mail.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    errors.email = "Informe um e-mail válido.";
  }

  if (!password) {
    errors.password = "Informe a senha.";
  }

  return errors;
}

function readSavedEmail() {
  try {
    const value = localStorage.getItem(SAVED_EMAIL_KEY)?.trim() ?? "";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return null;
    }

    return value;
  } catch {
    return null;
  }
}

function persistSavedEmail(email: string | null) {
  try {
    if (email) {
      localStorage.setItem(SAVED_EMAIL_KEY, email);
      return;
    }

    localStorage.removeItem(SAVED_EMAIL_KEY);
  } catch {
    // O navegador pode bloquear o armazenamento local.
  }
}

function readSavedPassword() {
  try {
    const value = localStorage.getItem(SAVED_PASSWORD_KEY);
    return value ? value : null;
  } catch {
    return null;
  }
}

function persistSavedPassword(password: string | null) {
  try {
    if (password) {
      localStorage.setItem(SAVED_PASSWORD_KEY, password);
      return;
    }

    localStorage.removeItem(SAVED_PASSWORD_KEY);
  } catch {
    // O navegador pode bloquear o armazenamento local.
  }
}

const EMPTY_SAVED_LOGIN = JSON.stringify({ email: "", password: "" });

function readSavedLogin() {
  const email = readSavedEmail() ?? "";
  const password = email ? (readSavedPassword() ?? "") : "";

  return JSON.stringify({ email, password });
}

function subscribeSavedLogin() {
  return () => {};
}

function parseSavedLogin(value: string) {
  try {
    const parsed = JSON.parse(value) as { email?: unknown; password?: unknown };

    return {
      email: typeof parsed.email === "string" ? parsed.email : "",
      password: typeof parsed.password === "string" ? parsed.password : "",
    };
  } catch {
    return { email: "", password: "" };
  }
}

function messageFromAuthError(error: {
  code?: string;
  status?: number;
}) {
  if (error.code === "INVALID_EMAIL_OR_PASSWORD" || error.status === 401) {
    return "E-mail ou senha incorretos.";
  }

  if (error.code === "INVALID_ORIGIN") {
    return "Este endereço não está autorizado a iniciar a sessão.";
  }

  return "Não foi possível entrar. Tente novamente.";
}

export function LoginForm() {
  const router = useRouter();
  const savedLogin = parseSavedLogin(
    useSyncExternalStore(subscribeSavedLogin, readSavedLogin, () => EMPTY_SAVED_LOGIN),
  );
  const [emailDraft, setEmailDraft] = useState<string | null>(null);
  const [passwordDraft, setPasswordDraft] = useState<string | null>(null);
  const [saveUserDraft, setSaveUserDraft] = useState<boolean | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const email = emailDraft ?? savedLogin.email;
  const password = passwordDraft ?? savedLogin.password;
  const saveUser = saveUserDraft ?? savedLogin.email.length > 0;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }

    const errors = validate(email, password);
    setFieldErrors(errors);
    setFormError(null);
    if (errors.email || errors.password) {
      return;
    }

    setPending(true);
    try {
      const trimmedEmail = email.trim();
      const result = await loginWithEmail(trimmedEmail, password, saveUser);
      if (result.error) {
        setFormError(messageFromAuthError(result.error));
        return;
      }

      if (saveUser) {
        persistSavedEmail(trimmedEmail);
        persistSavedPassword(password);
      } else {
        persistSavedEmail(null);
        persistSavedPassword(null);
      }
      router.replace("/");
      router.refresh();
    } catch {
      setFormError("Não foi possível entrar. Tente novamente.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-5" noValidate onSubmit={onSubmit}>
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-sm font-medium">
          E-mail
        </Label>
        <div className="relative">
          <Mail
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            placeholder="seu@email.com"
            value={email}
            disabled={pending}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? "email-error" : undefined}
            className={cn(loginFieldClassName, "pl-10")}
            onChange={(event) => setEmailDraft(event.target.value)}
          />
        </div>
        <p id="email-error" className="min-h-5 text-sm leading-5 text-destructive" aria-live="polite">
          {fieldErrors.email}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-sm font-medium">
          Senha
        </Label>
        <div className="relative">
          <Lock
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Digite sua senha"
            value={password}
            disabled={pending}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? "password-error" : undefined}
            className={cn(
              loginFieldClassName,
              "pr-12 pl-10 [&::-ms-clear]:hidden [&::-ms-reveal]:hidden",
            )}
            onChange={(event) => setPasswordDraft(event.target.value)}
          />
          <Button
            type="button"
            variant="ghost"
            className="absolute inset-y-0 right-0 z-10 h-full w-12 rounded-none px-0 text-muted-foreground hover:bg-transparent hover:text-foreground disabled:opacity-100"
            aria-pressed={showPassword}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            disabled={pending}
            onClick={() => setShowPassword((current) => !current)}
          >
            {showPassword ? (
              <EyeOff className="size-5" aria-hidden="true" />
            ) : (
              <Eye className="size-5" aria-hidden="true" />
            )}
          </Button>
        </div>
        <p
          id="password-error"
          className="min-h-5 text-sm leading-5 text-destructive"
          aria-live="polite"
        >
          {fieldErrors.password}
        </p>
      </div>

      <div className="flex items-center gap-2.5">
        <Checkbox
          id="save-user"
          name="save-user"
          checked={saveUser}
          disabled={pending}
          aria-describedby="save-user-hint"
          onCheckedChange={setSaveUserDraft}
        />
        <Label htmlFor="save-user" className="cursor-pointer text-sm font-normal">
          Lembrar de mim neste dispositivo
        </Label>
        <span id="save-user-hint" className="sr-only">
          Guarda o e-mail e a senha neste navegador. A sessão também permanece neste dispositivo.
        </span>
      </div>

      <p role="alert" aria-live="polite" className="min-h-5 text-sm leading-5 text-destructive">
        {formError}
      </p>

      <Button
        type="submit"
        size="lg"
        className="h-12 w-full rounded-lg text-sm font-medium"
        loading={pending}
      >
        <ArrowRight />
        {pending ? "Acessando…" : "Acessar sistema"}
      </Button>
    </form>
  );
}
