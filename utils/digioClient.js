import axios from "axios";
import fs from "fs";
import FormData from "form-data";

const DIGIO_BASE_URL =
  process.env.DIGIO_BASE_URL || "https://api.digio.in";

const DIGIO_CLIENT_ID = process.env.DIGIO_CLIENT_ID;
const DIGIO_CLIENT_SECRET = process.env.DIGIO_CLIENT_SECRET;

function digioAxios() {
  if (!DIGIO_CLIENT_ID || !DIGIO_CLIENT_SECRET) {
    const err = new Error("Missing DIGIO_CLIENT_ID / DIGIO_CLIENT_SECRET");
    err.code = "DIGIO_ENV_MISSING";
    throw err;
  }

  return axios.create({
    baseURL: DIGIO_BASE_URL,
    auth: {
      username: DIGIO_CLIENT_ID,
      password: DIGIO_CLIENT_SECRET,
    },
    headers: {
      "Content-Type": "application/json",
    },
    timeout: 60_000,
  });
}

/* ---------------- HEALTH CHECK ---------------- */
export async function checkDigioHealth() {
  try {
    const api = digioAxios();
    await api.get("/client/profile"); // SAFE endpoint
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      status: err?.response?.status,
      data: err?.response?.data,
    };
  }
}

/* ---------------- KYC REQUEST ---------------- */
export async function createKycRequest({
  customerId,
  name,
  email,
  phone,
  redirect_url,
}) {
  const api = digioAxios();

  const templateName = process.env.DIGIO_KYC_TEMPLATE_NAME;
  if (!templateName) {
    const e = new Error("Missing DIGIO_KYC_TEMPLATE_NAME");
    e.code = "DIGIO_TEMPLATE_MISSING";
    e.status = 500;
    throw e;
  }

  const payload = {
    reference_id: customerId,
    template_name: templateName,
    customer_identifier: customerId, // ✅ FIXED
    customer_name: name,
    customer_email: email,
    customer_phone: phone,
    redirect_url,
  };

  try {
    const { data } = await api.post(
      "/client/kyc/v2/request/with_template",
      payload
    );
    return data;
  } catch (err) {
    const e = new Error("Digio KYC request failed");
    e.code = "DIGIO_KYC_FAILED";
    e.status = err?.response?.status || 500;
    e.digio = err?.response?.data;
    throw e;
  }
}

/* ---------------- ESIGN REQUEST ---------------- */
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

  const { data } = await api.post(
    "/v2/client/document/uploadpdf",
    fd,
    {
      headers: fd.getHeaders(),
      maxBodyLength: Infinity,
    }
  );

  return data;
}
