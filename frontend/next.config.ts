import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // LAN addresses used to open the dev server (fixes HMR websocket + dev assets).
  allowedDevOrigins: ["172.16.0.2", "192.168.1.6"],
};

export default nextConfig;
