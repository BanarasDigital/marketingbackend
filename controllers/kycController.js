import path from "path";
import Kyc from "../models/KycModel.js";
import { createEsignRequest } from "../utils/digioClient.js";

export const getKycByCustomerId = async (req, res) => {
  try {
    const kyc = await Kyc.findOne({ customerId: req.params.customerId });
    if (!kyc) return res.status(404).json({ success: false, message: "KYC not found" });
    return res.json({ success: true, kyc });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Digio KYC webhook
export const digioKycWebhook = async (req, res) => {
  try {
    const payload = req.body;
    const customerId =
      payload?.customer_identifier ||
      payload?.customer_id ||
      payload?.reference_id;

    if (!customerId) return res.status(200).json({ ok: true });

    const kyc = await Kyc.findOne({ customerId });
    if (!kyc) return res.status(200).json({ ok: true });

    const statusRaw = (payload?.kyc_status || payload?.status || "").toUpperCase();

    if (statusRaw.includes("SUCCESS")) kyc.kycStatus = "SUCCESS";
    else if (statusRaw.includes("FAIL")) kyc.kycStatus = "FAILED";
    else kyc.kycStatus = "IN_PROGRESS";

    kyc.digioKycRefId = payload?.digio_kyc_ref_id || payload?.request_id || kyc.digioKycRefId;
    kyc.kycRaw = payload;

    await kyc.save();

    // Only if KYC success -> trigger eSign
    if (kyc.kycStatus === "SUCCESS" && kyc.esignStatus === "NOT_STARTED") {
      const agreementPath = process.env.AGREEMENT_PDF_PATH
        ? process.env.AGREEMENT_PDF_PATH
        : path.resolve("public", "agreement.pdf"); // served by express.static("public") :contentReference[oaicite:17]{index=17}

      const redirectUrl = process.env.DIGIO_ESIGN_REDIRECT_URL || process.env.CLIENT_URL;

      const esignResp = await createEsignRequest({
        customerId,
        signerName: payload?.name || kyc?.kycRaw?.customer_name || "Customer",
        signerEmail: payload?.email || kyc?.kycRaw?.customer_email || "",
        signerPhone: payload?.phone || kyc?.kycRaw?.customer_phone || "",
        agreementPdfAbsPath: agreementPath,
        redirect_url: redirectUrl,
      });

      kyc.digioEsignDocumentId = esignResp?.id || esignResp?.document_id || "";
      kyc.esignUrl = esignResp?.sign_url || esignResp?.redirect_url || "";
      kyc.esignStatus = "REQUESTED";
      kyc.esignRaw = esignResp;

      await kyc.save();
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("digioKycWebhook error:", err?.response?.data || err.message);
    return res.status(200).json({ ok: true }); // webhooks should still ACK
  }
};

// Digio eSign webhook
export const digioEsignWebhook = async (req, res) => {
  try {
    const payload = req.body;

    const customerId =
      payload?.reference_id ||
      payload?.customer_identifier ||
      payload?.customer_id;

    if (!customerId) return res.status(200).json({ ok: true });

    const kyc = await Kyc.findOne({ customerId });
    if (!kyc) return res.status(200).json({ ok: true });

    const statusRaw = (payload?.esign_status || payload?.status || "").toUpperCase();

    if (statusRaw.includes("COMPLETED") || statusRaw.includes("SUCCESS")) {
      kyc.esignStatus = "COMPLETED";
      kyc.signedAt = new Date(payload?.timestamp || Date.now());

      // If Digio provides signed document URL/id, store it:
      kyc.signedDocumentUrl =
        payload?.signed_document_url ||
        payload?.document_url ||
        kyc.signedDocumentUrl;
    } else if (statusRaw.includes("FAIL")) {
      kyc.esignStatus = "FAILED";
    }

    kyc.esignRaw = payload;
    await kyc.save();

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("digioEsignWebhook error:", err.message);
    return res.status(200).json({ ok: true });
  }
};
