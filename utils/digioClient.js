import axios from "axios";
import fs from "fs";
import FormData from "form-data";

const DIGIO_BASE_URL = process.env.DIGIO_BASE_URL || "https://ext.digio.in:444";
const DIGIO_CLIENT_ID = process.env.DIGIO_CLIENT_ID;
const DIGIO_CLIENT_SECRET = process.env.DIGIO_CLIENT_SECRET;

function digioAxios() {
  if (!DIGIO_CLIENT_ID || !DIGIO_CLIENT_SECRET) {
    const err = new Error("Missing DIGIO_CLIENT_ID / DIGIO_CLIENT_SECRET in env");
    err.code = "DIGIO_ENV_MISSING";
    throw err;
  }

  return axios.create({
    baseURL: DIGIO_BASE_URL,
    auth: { username: DIGIO_CLIENT_ID, password: DIGIO_CLIENT_SECRET },
    timeout: 60_000,
  });
}

function normalizeAxiosError(err) {
  const status = err?.response?.status;
  const data = err?.response?.data;

  return {
    message: err?.message || "Unknown error",
    status: status || 500,
    data: data || null,
    isAxiosError: !!err?.isAxiosError,
  };
}

export async function createKycRequest({ customerId, name, email, phone, redirect_url }) {
  const api = digioAxios();

  const templateName = process.env.DIGIO_KYC_TEMPLATE_NAME;
  if (!templateName) {
    const e = new Error("Missing DIGIO_KYC_TEMPLATE_NAME in env");
    e.code = "DIGIO_TEMPLATE_MISSING";
    e.status = 500;
    throw e;
  }

  const payload = {
    reference_id: customerId,
    template_name: templateName,
    customer_identifier: email,
    customer_name: name,
    customer_email: email,
    customer_phone: phone,
    redirect_url,
  };

  try {
    const { data } = await api.post("/client/kyc/v2/request/with_template", payload);
    return data;
  } catch (err) {
    const norm = normalizeAxiosError(err);

    // Attach normalized info so controller can return meaningful response
    const e = new Error("Digio KYC request failed");
    e.code = "DIGIO_KYC_FAILED";
    e.status = norm.status;
    e.digio = norm.data;
    e.details = norm;
    throw e;
  }
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
