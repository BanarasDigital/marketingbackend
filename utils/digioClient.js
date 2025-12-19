import axios from "axios";
import fs from "fs";
import FormData from "form-data";

const DIGIO_BASE_URL = process.env.DIGIO_BASE_URL || "https://ext.digio.in:444";
const DIGIO_CLIENT_ID = process.env.DIGIO_CLIENT_ID;
const DIGIO_CLIENT_SECRET = process.env.DIGIO_CLIENT_SECRET;

function digioAxios() {
  if (!DIGIO_CLIENT_ID || !DIGIO_CLIENT_SECRET) {
    throw new Error("Missing DIGIO_CLIENT_ID / DIGIO_CLIENT_SECRET in env");
  }
  return axios.create({
    baseURL: DIGIO_BASE_URL,
    auth: { username: DIGIO_CLIENT_ID, password: DIGIO_CLIENT_SECRET },
    timeout: 60_000,
  });
}
// utils/digioClient.js
export async function createKycRequest({
  customerId,
  name,
  email,
  phone,
  redirect_url,
}) {
  const api = digioAxios();

  const payload = {
    reference_id: customerId,
    template_name: process.env.DIGIO_KYC_TEMPLATE_NAME, 
    customer_identifier: email,
    customer_name: name,
    customer_email: email,
    customer_phone: phone,
    redirect_url,
  };

  const { data } = await api.post(
    "/client/kyc/v2/request/with_template",
    payload
  );

  return data;
}



export async function createEsignRequest({
  customerId,
  signerName,
  signerEmail,
  signerPhone,
  agreementPdfAbsPath,
  redirect_url,
}) {
  const api = digioAxios();

  const fd = new FormData();
  fd.append("file", fs.createReadStream(agreementPdfAbsPath));
  fd.append(
    "request",
    JSON.stringify({
      reference_id: customerId,
      redirect_url,
      signers: [
        {
          name: signerName,
          email: signerEmail,
          mobile_no: signerPhone,
          sign_type: "AADHAAR",
        },
      ],
    })
  );
console.log("Using Digio template:", process.env.DIGIO_KYC_TEMPLATE_NAME);

  const { data } = await api.post("/v2/client/document/uploadpdf", fd, {
    headers: fd.getHeaders(),
    maxBodyLength: Infinity,
  });

  return data;
}
