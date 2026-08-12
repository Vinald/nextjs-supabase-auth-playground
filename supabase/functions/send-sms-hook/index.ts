import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const AT_USERNAME = Deno.env.get("AFRICASTALKING_USERNAME") ?? "sandbox";
const AT_API_KEY = Deno.env.get("AFRICASTALKING_API_KEY");
// Sandbox endpoint. Switch to https://api.africastalking.com/version1/messaging for production.
const AT_ENDPOINT = "https://api.sandbox.africastalking.com/version1/messaging";

interface AfricasTalkingRecipient {
  statusCode: number;
  number: string;
  status: string;
  cost: string;
  messageId: string;
}

interface AfricasTalkingResponse {
  SMSMessageData: {
    Message: string;
    Recipients: AfricasTalkingRecipient[];
  };
}

async function sendSms(
  toNumber: string,
  message: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!AT_API_KEY) {
    return { ok: false, error: "AFRICASTALKING_API_KEY is not set" };
  }

  const body = new URLSearchParams({
    username: AT_USERNAME,
    to: toNumber,
    message,
  });

  const response = await fetch(AT_ENDPOINT, {
    method: "POST",
    headers: {
      apiKey: AT_API_KEY,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });

  if (!response.ok) {
    return { ok: false, error: `Africa's Talking HTTP ${response.status}` };
  }

  const data: AfricasTalkingResponse = await response.json();
  const recipient = data.SMSMessageData?.Recipients?.[0];

  if (!recipient || recipient.status !== "Success") {
    return {
      ok: false,
      error: recipient?.status ?? data.SMSMessageData?.Message ?? "Unknown Africa's Talking error",
    };
  }

  return { ok: true };
}

Deno.serve(async (req) => {
  const payload = await req.text();
  const hookSecret = Deno.env.get("SEND_SMS_HOOK_SECRET")?.replace("v1,whsec_", "");

  if (!hookSecret) {
    return new Response(
      JSON.stringify({
        error: { http_code: 500, message: "SEND_SMS_HOOK_SECRET is not set" },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const headers = Object.fromEntries(req.headers);
  const wh = new Webhook(hookSecret);

  try {
    const { user, sms } = wh.verify(payload, headers) as {
      user: { phone: string };
      sms: { otp: string };
    };

    const result = await sendSms(user.phone, `Your verification code is: ${sms.otp}`);

    if (!result.ok) {
      return new Response(
        JSON.stringify({
          error: { http_code: 500, message: `Failed to send SMS: ${result.error}` },
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: { http_code: 500, message: `Failed to send SMS: ${String(error)}` },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
