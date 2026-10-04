"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import styles from "./page.module.css";

type UserRole = "SA" | "PM" | "SS";

type MockUser = {
  user_id: string;
  role: UserRole;
  first_login: boolean;
  first_name: string;
  last_name: string;
};

type ApiResponse =
  | {
      success: true;
      user: MockUser & { token: string };
      token: string;
    }
  | {
      success: false;
      message: string;
    };

const mockUsers: Record<string, Omit<MockUser, "user_id">> = {
  SA101: {
    role: "SA",
    first_login: false,
    first_name: "Alicia",
    last_name: "Mendoza",
  },
  PM101: {
    role: "PM",
    first_login: false,
    first_name: "Marcus",
    last_name: "Dela Cruz",
  },
  SS101: {
    role: "SS",
    first_login: false,
    first_name: "Rafael",
    last_name: "Santos",
  },
};

const mockLoginRequest = async (
  userId: string,
  password: string,
): Promise<ApiResponse> => {
  await new Promise((resolve) => setTimeout(resolve, 700));

  const normalizedId = userId.trim().toUpperCase();
  const user = mockUsers[normalizedId];

  if (!user || password.trim().length < 6) {
    return {
      success: false,
      message: "Invalid User ID or Password. Please try again.",
    };
  }

  return {
    success: true,
    user: {
      user_id: normalizedId,
      role: user.role,
      first_login: user.first_login,
      first_name: user.first_name,
      last_name: user.last_name,
      token: "mock-token-for-" + normalizedId,
    },
    token: "mock-token-for-" + normalizedId,
  };
};

export default function PortalPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!userId.trim() || !password.trim()) {
      setError("Invalid User ID or Password. Please try again.");
      return;
    }

    setIsLoading(true);
    setError("");

    const result = await mockLoginRequest(userId, password);
    setIsLoading(false);

    if (!result.success) {
      setError(result.message);
      return;
    }

    const { user, token } = result;

    localStorage.setItem("struktura_token", token);
    localStorage.setItem("struktura_user", JSON.stringify(user));

    if (user.first_login) {
      router.push("/portal/change-password");
      return;
    }

    const redirectMap: Record<UserRole, string> = {
      SA: "/portal/dashboard/sa",
      PM: "/portal/dashboard/pm",
      SS: "/portal/dashboard/ss",
    };

    router.push(redirectMap[user.role]);
  };

  return (
    <main className={styles.pageShell}>
      <div className={styles.card}>
        <div className={styles.logoWrap}>
          <Image
            src="/assets/struktura-banner.png"
            alt="Struktura banner"
            width={360}
            height={90}
            priority
            className={styles.bannerImage}
          />
        </div>

        <h1 className={styles.title}>PORTAL LOGIN</h1>
        <p className={styles.subtitle}>
          Sign in with your assigned credentials
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error ? <div className={styles.alert}>{error}</div> : null}

          <div className={styles.fieldGroup}>
            <label htmlFor="userId" className={styles.label}>
              USER ID
            </label>
            <input
              id="userId"
              type="text"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              placeholder="e.g., SA101, PM101, SS101"
              autoComplete="username"
              required
            />
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="password" className={styles.label}>
              PASSWORD
            </label>
            <div className={styles.passwordWrap}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className={styles.toggleButton}
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className={styles.loginButton}
            disabled={isLoading}
          >
            {isLoading ? "LOGGING IN..." : "LOG IN"}
          </button>
        </form>

        <p className={styles.helperText}>
          Need access? Contact your system administrator.
        </p>
      </div>
    </main>
  );
}
