declare module 'react-native-openvpn' {
    interface VPNConfig {
        ovpnFileContents: string;
        provider?: string;
        username?: string;
        password?: string;
        allowSelfSigned?: boolean;
    }

    const OpenVPN: {
        connect: (config: VPNConfig) => Promise<void>;
        disconnect: () => Promise<void>;
    };

    export default OpenVPN;
}
