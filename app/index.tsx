import React, { useState } from "react";
import RNSimpleOpenvpn from "react-native-simple-openvpn";
import * as DocumentPicker from "expo-document-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import 'expo-dev-client';
import * as Device from "expo-device";
import {StyleSheet,Text,View,TouchableOpacity,Alert,Image,ScrollView,Modal,TextInput,} from "react-native";


export default function App() {

// State to store username and password input by the user
const [username, setUsername] = useState("");
const [password, setPassword] = useState("");
// Modal visibility state for prompting user credentials
const [modalVisible, setModalVisible] = useState(false);
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
          setModalVisible(true);
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
  const saveCertificate = async() => {
    if (!currentCertName || !currentCertContent) {
      Alert.alert("Error", "No certificate to save.");
      return;
    }
    setModalVisible(false);// close modal after saving
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
  
  // Certs load on start
  React.useEffect(() => {
    loadCertificatesFromStorage();
  }, []);
  
  const handleConnect = async () => {
    if (!selectedCertificate) {
      Alert.alert("Error", "No certificate selected.");
      return;
    }
    
    const certificate = certificates.find(cert => cert.name === selectedCertificate);
    if (!certificate || !certificate.content || !certificate.username || !certificate.password) {
      Alert.alert("Error", "Invalid certificate data.");
      return;
    }
    
    try {
      setVpnStatus("Connecting...");
      await RNSimpleOpenvpn.connect({
        ovpnString: certificate.content,
        username: certificate.username,
        password: certificate.password,
        providerBundleIdentifier: ""
      });
  
      // Wait for VPN to fully connect
      let status = await RNSimpleOpenvpn.getCurrentState();
      while (status !== RNSimpleOpenvpn.VpnState.VPN_STATE_CONNECTED) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        status = await RNSimpleOpenvpn.getCurrentState();
      }
  
      setVpnStatus("Connected");
      setIsConnected(true);
      Alert.alert("Success", `Connected using ${certificate.name}`);
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

  const handleCreateCertificate = async () => {
    const forge = require('node-forge');
    //const fs = require('fs');
    try {
      const response = await fetch("https://your-server.com/api/create-cert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ deviceId: "user-device-123" }),
      });
  
      const data = await response.json();
  
      if (data.success) {
        Alert.alert("Success", "VPN Certificate created. You can now connect remotely.");
        setCertificates((prev) => [...prev, { name: "MyVPN.ovpn", content: data.ovpn, username, password }]);
      } else {
        Alert.alert("Error", "Failed to create VPN certificate.");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert("Error", `Certificate creation failed: ${errorMessage}`);
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

        <TouchableOpacity style={styles.createCertButton} onPress={handleCreateCertificate}>
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
          visible={modalVisible}
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
