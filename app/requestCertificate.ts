import forge from "node-forge";
import RNFS from 'react-native-fs';

export async function requestCertificate(req: Request) {
  try {
    const { username } = await req.json();

    if (!username) {
      return { error: "Username required" };
    }

    // Generate Private Key
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);

    // Generate CSR (Certificate Signing Request)
    const csr = forge.pki.createCertificationRequest();
    csr.publicKey = keys.publicKey;
    csr.setSubject([{ name: "commonName", value: username }]);
    csr.sign(keys.privateKey);

    const csrPem = forge.pki.certificationRequestToPem(csr);

    // Send CSR to Raspberry Pi for signing
    const response = await fetch("http://192.168.50.30:1194/sign_certificate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, csrPem }),
    });

    if (!response.ok) {
      throw new Error(`Pi error: ${response.statusText}`);
    }
    console.log("Status: " + response.status);
    console.log("Status Text: " + response.statusText);
    console.log("Waiting for JSON");

    const fullJsonResponse = await response.json();
    console.log(fullJsonResponse);
    const { signedCertPem } = fullJsonResponse;

    // Save the signed certificate and private key
    const filePath = `${RNFS.DocumentDirectoryPath}/${username}.ovpn`;
    const ovpnProfile = `
    client
    dev tun
    proto udp
    remote your.server.com 1194
    resolv-retry infinite
    nobind
    persist-key
    persist-tun
    auth SHA256
    cipher AES-256-CBC
    verb 3
    <cert>
    ${signedCertPem.trim()}
    </cert>
    <key>
    ${privateKeyPem.trim()}
    </key>
    `;

    await RNFS.writeFile(filePath, ovpnProfile, "utf8");

    return { certName: username, certContent: ovpnProfile };
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(error);
    console.error("Error: " + errorMessage);
    return { error: `Certificate request failed: ${errorMessage}` };
  }
}
export default requestCertificate;