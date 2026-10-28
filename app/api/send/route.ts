import { authorize, reauthenticate, AuthError } from "@/lib/db";
import axios from "axios";
import nodemailer from "nodemailer";
import sanitize from "sanitize-html";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(req: Request) {
  try {
    const { db, user } = await authorize(req);
    const b = await req.json();
    await reauthenticate(user.email!, b.password);

    if (!/^[a-f0-9-]{36}$/i.test(b.requestId || "")) throw Error("Invalid request ID");
    const { data: v } = await db.from("ms_versions").select("*,ms_messages(channel)").eq("id", b.versionId).single();
    if (!v) throw Error("Version not found");
    const channel = v.ms_messages.channel;
    let c = null;
    if (channel === "email") {
      const { data } = await db.from("ms_connections").select("*").eq("id", v.connection_id).eq("channel", "email").single();
      if (!data) throw Error("Choose an email sender");
      c = data;
    }
    const { data: r } = await db.from("ms_recipients").select("*").eq("id", b.recipientId).single();
    if (!r) throw Error("Recipient not found");

    const dest = channel === "email" ? r.email : r.phone;
    if (!dest) throw Error("Recipient has no destination for this channel");

    const key = b.requestId + ":" + r.id;
    const { data: attempt, error } = await db
      .from("ms_attempts")
      .insert({ version_id: v.id, recipient_id: r.id, destination: dest, status: "sending", request_key: key })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") return Response.json({ status: "already_requested" });
      throw error;
    }

    try {
      const body = v.body.replaceAll("{{name}}", r.name || "there");
      if (channel === "email" && c) {
        if (!b.smtpPassword) throw Error("SMTP password required");
        const transport = nodemailer.createTransport({
          host: c.config.server,
          port: Number(c.config.port),
          secure: Number(c.config.port) === 465,
          requireTLS: Number(c.config.port) !== 465,
          auth: { user: c.config.user, pass: b.smtpPassword },
          connectionTimeout: 15000,
          socketTimeout: 20000,
          tls: { rejectUnauthorized: false },
        });
        try {
          await transport.sendMail({
            from: { name: c.config.fromName || c.label, address: c.config.fromEmail || c.config.user },
            to: dest,
            subject: v.subject.replaceAll("{{name}}", r.name || "there"),
            html: sanitize(body, {
              allowedTags: sanitize.defaults.allowedTags.concat(["img"]),
              allowedAttributes: { ...sanitize.defaults.allowedAttributes, img: ["src", "alt", "width", "height"] },
            }),
            attachments: (v.attachments || []).map((a: { name: string; content: string }) => ({
              filename: a.name,
              content: Buffer.from(a.content, "base64"),
            })),
          });
        } finally {
          transport.close();
        }
      } else {
        await sendSms(dest, body);
      }
      const { error: updateError } = await db.from("ms_attempts").update({ status: "success" }).eq("id", attempt.id);
      if (updateError) throw Error("Provider accepted, but delivery record update failed");
      return Response.json({ status: "success" });
    } catch (e) {
      const message = (e as Error).message;
      await db.from("ms_attempts").update({ status: "unknown", error: message }).eq("id", attempt.id);
      return Response.json({ status: "unknown", error: message });
    }
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: e instanceof AuthError ? e.status : 400 });
  }
}

async function sendSms(phone: string, message: string) {
  const receiver = phone;

  const messageBody = {
    sender: "SupaSpace",
    recipients: [receiver],
    message: message,
  };

  try {
    const response = await axios({
      url: process.env.SMS_RUNNER_URL,
      data: messageBody,
      method: "POST",
      headers: {
        "api-key": process.env.SMS_RUNNER_TOKEN,
      },
    });
    return response.data;
  } catch (error: any) {
    console.log(error?.response?.data! || error);
    throw new Error("Sorry! We couldn`t send the sms to your phone");
  }
}
