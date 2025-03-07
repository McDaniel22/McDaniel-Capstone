import React, { useState } from "react";
import RNSimpleOpenvpn from "react-native-simple-openvpn";
import * as DocumentPicker from "expo-document-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import 'expo-dev-client';
import forge from 'node-forge';
import RNFS from 'react-native-fs';
import { StyleSheet, Text, View, TouchableOpacity, Alert, Image, ScrollView, Modal, TextInput, Button, } from "react-native";


export default function App() {
  // State to store username and password input by the user
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  // Modal visibility state for prompting user credentials & saving certificates
  const [modalVisibleImport, setModalVisibleImport] = useState(false);
  const [modalVisibleCreate, setModalVisibleCreate] = useState(false);
  // Store the name and content of the certificate currently being uploaded
  const [currentCertName, setCurrentCertName] = useState("");
  const [currentCertContent, setCurrentCertContent] = useState("");
  const [vpnStatus, setVpnStatus] = useState("Disconnected");
  const [certificates, setCertificates] = useState<{ name: string; content: string; username: string; password: string }[]>([]);
  // Store uploaded certificates
  const [selectedCertificate, setSelectedCertificate] = useState<string | null>(null); // Currently selected certificate
  const [isConnected, setIsConnected] = useState(false);

  // Import Certificate
  const handleImportCertificate = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*", // Accept all files
        copyToCacheDirectory: true
      });

      if (!result.canceled) {
        const certificateUri = result.assets[0].uri;
        const certificateName = result.assets[0].name;
        // Check if the selected file is an OpenVPN file
        if (!certificateName.endsWith(".ovpn")) {
          Alert.alert("Error", "Please select a valid OpenVPN (.ovpn) file.");
          return;
        }
        // Save the file permanently in the app's document directory
        const newFileUri = `${FileSystem.documentDirectory}${certificateName}`;
        await FileSystem.copyAsync({
          from: certificateUri,
          to: newFileUri
        });
        // Read file content
        const fileContent = await FileSystem.readAsStringAsync(certificateUri);
        //update state first then save
        setCurrentCertName(certificateName);
        setCurrentCertContent(fileContent);
        setModalVisibleImport(true);
        // Add certificate to the list

      } else {
        Alert.alert("Error", "No certificate selected.");
      }// checks if its an ovpn file
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert("Error", `Failed to upload certificate: ${errorMessage}`);
    }
  };
  const saveCertificatesToStorage = async (certificates: { name: string; content: string; username: string; password: string; }[]) => {
    try {
      await AsyncStorage.setItem("certificates", JSON.stringify(certificates));
    } catch (error) {
      Alert.alert("Error", "Failed to save certificates.");
    }
  };
  // Function to save the certificate along with user-provided credentials
  const saveCertificate = async () => {
    if (!currentCertName || !currentCertContent || !username || !password) {
      Alert.alert("Error", "Missing required fields!");
      return;
    }
    setModalVisibleImport(false);// close modal after saving
    const newCertificates = [
      ...certificates,
      { name: currentCertName, content: currentCertContent, username, password }
    ];
    setCertificates(newCertificates);
    await saveCertificatesToStorage(newCertificates); // Save to AsyncStorage
    // Reset state and close modal
    setCurrentCertName("");
    setCurrentCertContent("");
    Alert.alert("Success", `${currentCertName} uploaded successfully.`);
  };
  const loadCertificatesFromStorage = async () => {
    try {
      const storedCertificates = await AsyncStorage.getItem("certificates");
      if (storedCertificates) {
        setCertificates(JSON.parse(storedCertificates));
      }
    } catch (error) {
      Alert.alert("Error", "Failed to load certificates.");
    }
  };

  // Certs load on start & checks for vpn connection so app doesnt break
  React.useEffect(() => {
    loadCertificatesFromStorage();
    const checkVpnStatus = async () => {
      try {
        const currentState = await RNSimpleOpenvpn.getCurrentState();
        console.log("VPN Status on Load:", currentState);

        if (currentState === RNSimpleOpenvpn.VpnState.VPN_STATE_CONNECTED) {
          setIsConnected(true);
          setVpnStatus("Connected");
        } else {
          setIsConnected(false);
          setVpnStatus("Disconnected");
        }
      } catch (error) {
        console.error("Error checking VPN status:", error);
      }
    };

    checkVpnStatus();
  }, []);

  const handleConnect = async () => {
    try {
      const currentState = await RNSimpleOpenvpn.getCurrentState();
      if (currentState === RNSimpleOpenvpn.VpnState.VPN_STATE_CONNECTED) {
        Alert.alert("Info", "VPN is already connected.");
        setIsConnected(true);
        setVpnStatus("Connected");
        return;
      }
    } catch (error) {
      console.log("Error checking VPN status:", error);
    }
    if (!selectedCertificate) {
      Alert.alert("Error", "No certificate selected.");
      return;
    }
    const filePath = `${RNFS.DocumentDirectoryPath}/${selectedCertificate}`;
    const fileExists = await RNFS.exists(filePath);
    if (!fileExists) {
      Alert.alert("Error", "VPN certificate file not found.");
      return;
    }
    const ovpnString = await RNFS.readFile(filePath, 'utf8');
    console.log("OVPN File Content:", ovpnString);
    const certificate = certificates.find(cert => cert.name === selectedCertificate);
    if (!certificate || !certificate.content || !certificate.username || !certificate.password) {
      Alert.alert("Error", "Invalid certificate data.");
      return;
    }
    try {
      setVpnStatus("Connecting...");
      await RNSimpleOpenvpn.connect({
        ovpnString: ovpnString,
        username: certificate.username,
        password: certificate.password,
        providerBundleIdentifier: ""
      });
      // Wait for VPN to fully connect
      let status;
      do {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        status = await RNSimpleOpenvpn.getCurrentState();
        console.log(status);
        console.log(JSON.stringify(RNSimpleOpenvpn.VpnState));
      } while (status !== RNSimpleOpenvpn.VpnState.VPN_STATE_CONNECTED && status !== RNSimpleOpenvpn.VpnState.VPN_STATE_DISCONNECTED);
      if (status === RNSimpleOpenvpn.VpnState.VPN_STATE_CONNECTED) {
        setVpnStatus("Connected");
        setIsConnected(true);
        Alert.alert("Success", `Connected using ${certificate.name}`);
      } else {
        setVpnStatus("Disconnected");
        setIsConnected(false);
        Alert.alert("Error", "Failed to connect to VPN.");
      }
    } catch (error) {
      setVpnStatus("Disconnected");
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert("Error", `Failed to connect: ${errorMessage}`);
    }
  };


  // Disconnect VPN
  const handleDisconnect = async () => {
    try {
      if (!isConnected) {
        Alert.alert("Error", "VPN is not connected.");
        return;
      }
      setVpnStatus("Disconnecting...");
      await RNSimpleOpenvpn.disconnect();
      setVpnStatus("Disconnected");
      setIsConnected(false);
      Alert.alert("Disconnected", "VPN has been disconnected.");

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert("Error", `Failed to disconnect: ${errorMessage}`);
    }
  };
  const handleDeleteCertificate = (nameToDelete: string) => {
    Alert.alert(
      "Delete Certificate",
      `Are you sure you want to delete ${nameToDelete}?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const updatedCertificates = certificates.filter(cert => cert.name !== nameToDelete);
            setCertificates(updatedCertificates);
            await saveCertificatesToStorage(updatedCertificates);
            // Delete the actual file from storage
            const certToDelete = certificates.find(cert => cert.name === nameToDelete);
            if (certToDelete) {
              await FileSystem.deleteAsync(certToDelete.content);
            }
            if (selectedCertificate === nameToDelete) {
              setSelectedCertificate(null);
            }
            Alert.alert("Deleted", `${nameToDelete} has been deleted.`);
          },
        },
      ]
    );
  };
  //Creates VPN cert from same network as pi
  const handleCreateCertificate = async () => {
    try {
      if (!username || !password || !currentCertName) {
        Alert.alert("Error", "Missing required fields!");
        return;
      }
      Alert.alert("Creating Certificate", "Generating your certificate...", []);
      const generateStaticKey = () => {
        const staticKey = forge.util.bytesToHex(forge.random.getBytesSync(2048)); // Generates a 2048-bit static key
        return `-----BEGIN OpenVPN Static key V1-----\n${staticKey}\n-----END OpenVPN Static key V1-----`;
      };
      const staticKey = generateStaticKey();
      console.log("Generating key pair...");
      // Generate Private Key
      const keys = forge.pki.rsa.generateKeyPair(2048);
      const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);

      console.log("Generating CSR...");
      // Generate CSR (Certificate Signing Request)
      const csr = forge.pki.createCertificationRequest();
      csr.publicKey = keys.publicKey;

      csr.setSubject([{ name: "commonName", value: username }]);

      // Required for OpenVPN compatibility
      csr.setAttributes([{ name: "countryName", value: "US" }]);

      csr.sign(keys.privateKey);

      // Convert to PEM format
      const csrPem = forge.pki.certificationRequestToPem(csr).trim();

      console.log("Generated CSR:", csrPem);

      // Send CSR to Raspberry Pi for signing
      const response = await fetch("http://192.168.50.30:5000/sign_certificate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, csrPem }),
        //timeout: 0,
      });

      console.log("Response status:", response.status, response.statusText);

      if (!response.ok) {
        throw new Error(`Pi error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Received signed certificate:", data);

      if (!data.signedCertPem) {
        throw new Error("Signed certificate is missing in response!");
      }

      const ovpnProfile = `
client
proto udp
explicit-exit-notify
remote 192.168.50.30 1194
dev tun
resolv-retry infinite
nobind
persist-key
persist-tun
remote-cert-tls server
verify-x509-name server_Z5dSfRUV9TzADZcF name
auth SHA256
auth-nocache
cipher AES-128-GCM
tls-client
tls-version-min 1.2
tls-cipher TLS-ECDHE-ECDSA-WITH-AES-128-GCM-SHA256
ignore-unknown-option block-outside-dns
setenv opt block-outside-dns # Prevent Windows 10 DNS leak
verb 3
          <ca>
          ${data.caCertPem.trim()}
          </ca>

          <cert>
          ${data.signedCertPem.trim()}
          </cert>
          
          <key>
          ${privateKeyPem.trim()}
          </key>

          <tls-crypt>
          ${data.tlsStaticKey.trim()}
          </tls-crypt>
          `;


      const fileContent = data.signedCertPem;
      const certificateName = `${currentCertName}.ovpn`;
      setCurrentCertName(certificateName);
      const newFileUri = `${FileSystem.documentDirectory}${certificateName}`;
      console.log("Writing certificate to file:", newFileUri);
      console.log("Certificate Name:", certificateName);
      await FileSystem.writeAsStringAsync(
        newFileUri,
        ovpnProfile,
        { encoding: FileSystem.EncodingType.UTF8 }
      );
      //setCurrentCertName(certificateName);
      Alert.alert("Success", "Certificate created successfully.");

      setCurrentCertContent(ovpnProfile);
      setModalVisibleCreate(false);
      setModalVisibleImport(true);
    } catch (error) {
      if (error instanceof Error) {
        console.error("Network Error:", error.message);
      } else {
        console.error("Network Error:", error);
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert("Error", `Certificate creation failed: ${errorMessage}`);
    }
  };



  return (
    <ScrollView>
      <View style={styles.container}>
        <Image
          source={require('../assets/images/HomeNetLogo2.png')}
          style={styles.headerImage}
          resizeMode="contain"
        />

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
            style={styles.importButton}
            onPress={handleImportCertificate}
          >
            <Text style={styles.buttonText}>Import Certificate</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.createCertButton} onPress={() => setModalVisibleCreate(true)}>
            <Text style={styles.buttonText}>Create VPN Certificate</Text>
          </TouchableOpacity>

          {certificates.length > 0 && (
            <View style={styles.certificateList}>
              <Text style={styles.listHeader}>Imported Certificates:</Text>
              {certificates.map((cert, index) => (
                <View key={index} style={styles.certificateItemContainer}>
                  <TouchableOpacity
                    style={[
                      styles.certificateItem,
                      selectedCertificate === cert.name && styles.selected,
                    ]}
                    onPress={() => setSelectedCertificate(cert.name)}
                  >
                    <Text style={styles.certificateText}>{cert.name}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteCertificate(cert.name)}
                  >
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Modal for Username and Password */}
          <Modal
            visible={modalVisibleImport}
            transparent={true}
            animationType="slide"
          >
            <View style={styles.modalContainer}>
              <View style={styles.modalContainer}>
                <Text style={styles.modalTitle}>Enter Credentials</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Username"
                  value={username}
                  onChangeText={setUsername}
                />
                <TextInput
                  style={styles.modalInput}
                  placeholder="Password"
                  value={password}
                  secureTextEntry
                  onChangeText={setPassword}
                />
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={saveCertificate}
                >
                  <Text style={styles.buttonText}>Save Certificate</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
          <Modal
            visible={modalVisibleCreate}
            transparent={true}
            animationType="slide"
          >
            <View style={styles.modalContainer}>
              <View style={styles.modalContainer}>
                <Text style={styles.modalTitle}>Enter Credentials</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Username"
                  value={username}
                  onChangeText={setUsername}
                />
                <TextInput
                  style={styles.modalInput}
                  placeholder="Password"
                  value={password}
                  secureTextEntry
                  onChangeText={setPassword}
                />
                <TextInput
                  style={styles.modalInput}
                  placeholder="Certificate Name"
                  value={currentCertName}
                  onChangeText={setCurrentCertName}
                />
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={handleCreateCertificate}
                >
                  <Text style={styles.buttonText}>Save Certificate</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </View>
      </View>
    </ScrollView>
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
  headerImage: {
    width: 500,
    height: 300,
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
    backgroundColor: "#3a7fbc",
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
  createCertButton: {
    backgroundColor: "#4cb3fa",
    padding: 10,
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
  importButton: {
    backgroundColor: "#1e2b4e",
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  certificateList: {
    marginTop: 20,
    width: "90%",
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  listHeader: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  certificateItem: {
    padding: 10,
    backgroundColor: "#f9f9f9",
    marginBottom: 5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  selected: {
    borderColor: "#1a73e8",
    backgroundColor: "#eaf3ff",
  },
  disabledButton: {
    backgroundColor: "#ccc",
  },
  certificateText: {
    fontSize: 14,
    color: "#444",
  },
  certificateItemContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8f8f8",
    padding: 10,
    marginVertical: 5,
    borderRadius: 8,
  },

  deleteButton: {
    backgroundColor: "#FF6347",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
  },

  deleteButtonText: {
    color: "white",
    fontWeight: "bold",
  },

  modalBackground: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContainer: {
    width: "80%",
    margin: "auto",
    backgroundColor: "white",
    padding: 20,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5, // For Android shadow
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  modalInput: {
    height: 40,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    marginBottom: 15,
  },
  modalButton: {
    backgroundColor: "#1a73e8",
    paddingVertical: 10,
    borderRadius: 5,
    alignItems: "center",
    marginBottom: 10,
  },
  modalButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  modalCancelButton: {
    backgroundColor: "#888",
    paddingVertical: 10,
    borderRadius: 5,
    alignItems: "center",
  },
});
