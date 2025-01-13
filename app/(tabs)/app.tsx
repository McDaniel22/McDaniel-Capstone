import React, { useState } from "react";
import { StyleSheet, Text, View, Button, TouchableOpacity, TextInput, Alert } from "react-native";

export default function App() {
const [vpnStatus, setVpnStatus] = useState("Disconnected");
const [certificate, setCertificate] = useState("");
const [isConnected, setIsConnected] = useState(false);

const handleConnect = () => {
    if (certificate) {
    setVpnStatus("Connecting...");
    setTimeout(() => {
        setVpnStatus("Connected");
        setIsConnected(true);
      }, 2000); // Simulates a VPN connection process
    } else {
    Alert.alert("Error", "Please upload a certificate first.");
    }
};

const handleDisconnect = () => {
    setVpnStatus("Disconnecting...");
    setTimeout(() => {
    setVpnStatus("Disconnected");
    setIsConnected(false);
    }, 2000); // Simulates a VPN disconnection process
};

const handleUploadCertificate = () => {
    // For demonstration purposes, simulates certificate upload
    setCertificate("SampleRouterCertificate123");
    Alert.alert("Certificate Uploaded", "Your router certificate has been uploaded successfully!");
};

return (
    <View style={styles.container}>
      {/* App Header */}
    <Text style={styles.header}>HomeNet VPN</Text>

      {/* VPN Status Display */}
    <Text style={styles.statusLabel}>VPN Status:</Text>
    <Text style={[styles.status, isConnected ? styles.connected : styles.disconnected]}>
        {vpnStatus}
    </Text>

      {/* Connect/Disconnect Buttons */}
    {!isConnected ? (
        <TouchableOpacity style={styles.connectButton} onPress={handleConnect}>
        <Text style={styles.buttonText}>Connect</Text>
        </TouchableOpacity>
    ) : (
        <TouchableOpacity style={styles.disconnectButton} onPress={handleDisconnect}>
        <Text style={styles.buttonText}>Disconnect</Text>
        </TouchableOpacity>
    )}

      {/* Upload Certificate Section */}
    <View style={styles.certificateSection}>
        <Text style={styles.label}>Manage Certificate:</Text>
        <TouchableOpacity style={styles.uploadButton} onPress={handleUploadCertificate}>
        <Text style={styles.buttonText}>Upload Certificate</Text>
        </TouchableOpacity>
        {certificate ? <Text style={styles.certificateInfo}>Certificate: {certificate}</Text> : null}
    </View>
    </View>
);
}

const styles = StyleSheet.create({
container: {
    flex: 1,
    backgroundColor: "#f4f4f4",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
},
header: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1a73e8",
    marginBottom: 20,
},
statusLabel: {
    fontSize: 18,
    color: "#333",
    marginTop: 10,
},
status: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
},
connected: {
    color: "green",
},
disconnected: {
    color: "red",
},
connectButton: {
    backgroundColor: "#1a73e8",
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
},
disconnectButton: {
    backgroundColor: "red",
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
},
buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
},
certificateSection: {
    marginTop: 30,
    alignItems: "center",
},
label: {
    fontSize: 16,
    color: "#555",
    marginBottom: 10,
},
uploadButton: {
    backgroundColor: "#1a73e8",
    padding: 10,
    borderRadius: 10,
},
certificateInfo: {
    marginTop: 10,
    fontSize: 14,
    color: "#666",
},
});
