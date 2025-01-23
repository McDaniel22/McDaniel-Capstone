import React, { useState } from "react";
import OpenVPN from "react-native-openvpn";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
} from "react-native";

export default function App() {
  const [vpnStatus, setVpnStatus] = useState("Disconnected");
  const [certificates, setCertificates] = useState<
    { name: string; content: string }[]
  >([]); // Store uploaded certificates
  const [selectedCertificate, setSelectedCertificate] = useState<string | null>(
    null
  ); // Currently selected certificate
  const [isConnected, setIsConnected] = useState(false);

  // Upload Certificate
  const handleUploadCertificate = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/x-openvpn-profile", // Accept OpenVPN profiles
        copyToCacheDirectory: true,
      });

      if (!result.canceled) {
        const certificateUri = result.assets[0].uri;
        const certificateName = result.assets[0].name;

        // Read file content
        const fileContent = await FileSystem.readAsStringAsync(certificateUri);

        // Add certificate to the list
        setCertificates((prev) => [
          ...prev,
          { name: certificateName, content: fileContent },
        ]);

        Alert.alert("Success", `${certificateName} uploaded successfully.`);
      } else {
        Alert.alert("Error", "No certificate selected.");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      Alert.alert("Error", `Failed to upload certificate: ${errorMessage}`);
    }
  };

  // Connect to VPN
  const handleConnect = async () => {
    if (!selectedCertificate) {
      Alert.alert("Error", "No certificate selected.");
      return;
    }

    const certificate = certificates.find(
      (cert) => cert.name === selectedCertificate
    );
    if (!certificate) {
      Alert.alert("Error", "Selected certificate not found.");
      return;
    }

    try {
      setVpnStatus("Connecting...");
      await OpenVPN.connect({
        config: certificate.content,
        username: "",
        password: "",
        compression: true,
      });
      setVpnStatus("Connected");
      setIsConnected(true);
      Alert.alert("Success", `Connected using ${certificate.name}`);
    } catch (error) {
      setVpnStatus("Disconnected");
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      Alert.alert("Error", `Failed to connect: ${errorMessage}`);
    }
  };

  // Disconnect VPN
  const handleDisconnect = async () => {
    try {
      setVpnStatus("Disconnecting...");
      await OpenVPN.disconnect();
      setVpnStatus("Disconnected");
      setIsConnected(false);
      Alert.alert("Disconnected", "VPN has been disconnected.");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      Alert.alert("Error", `Failed to disconnect: ${errorMessage}`);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>HomeNet VPN</Text>

      <Text style={styles.statusLabel}>VPN Status:</Text>
      <Text
        style={[
          styles.status,
          isConnected ? styles.connected : styles.disconnected,
        ]}
      >
        {vpnStatus}
      </Text>

      {!isConnected ? (
        <TouchableOpacity
          style={[
            styles.connectButton,
            !selectedCertificate && styles.disabledButton,
          ]}
          onPress={handleConnect}
          disabled={!selectedCertificate}
        >
          <Text style={styles.buttonText}>Connect</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.disconnectButton}
          onPress={handleDisconnect}
        >
          <Text style={styles.buttonText}>Disconnect</Text>
        </TouchableOpacity>
      )}

      <View style={styles.certificateSection}>
        <Text style={styles.label}>Manage Certificates:</Text>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={handleUploadCertificate}
        >
          <Text style={styles.buttonText}>Upload Certificate</Text>
        </TouchableOpacity>

        {certificates.length > 0 && (
          <View style={styles.certificateList}>
            <Text style={styles.listHeader}>Uploaded Certificates:</Text>
            {certificates.map((cert, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.certificateItem,
                  selectedCertificate === cert.name && styles.selected,
                ]}
                onPress={() => setSelectedCertificate(cert.name)}
              >
                <Text style={styles.certificateText}>{cert.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
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
    width: "100%",
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
    marginBottom: 10,
  },
  certificateList: {
    marginTop: 10,
    width: "100%",
  },
  listHeader: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
  },
  certificateItem: {
    padding: 10,
    backgroundColor: "#fff",
    marginBottom: 5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  selected: {
    borderColor: "#1a73e8",
  },
  disabledButton: {
    backgroundColor: "#ccc",
  },
  certificateText: {
    fontSize: 14,
  },
});
