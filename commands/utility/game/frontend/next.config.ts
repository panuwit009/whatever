import type { NextConfig } from "next"
import path from "node:path";

const nextConfig: NextConfig = {
    allowedDevOrigins: ['192.168.1.6', 'tin.local', '25.35.111.199'],
    turbopack: {
        root: path.resolve(__dirname),
    },
}

export default nextConfig
