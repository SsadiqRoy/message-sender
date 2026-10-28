"use client";
import { useEffect, useState } from "react";
import { createClient, Session } from "@supabase/supabase-js";
import { FiMail, FiUsers, FiSettings, FiSend, FiMessageSquare, FiPlus, FiX, FiUpload } from "react-icons/fi";
import Papa from "papaparse";
import DOMPurify from "dompurify";
type Row = Record<string, any>;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://heygymzqxlllfimddssn.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_nqTqS8XuNjuhFvIvRWscpg_mX-NEdsD",
);
export default function App() {
  const [session, S] = useState<Session | null>(null),
    [ready, R] = useState(false),
    [data, D] = useState<Row>({ messages: [], versions: [], recipients: [], connections: [], attempts: [] }),
    [tab, T] = useState("Messages"),
    [query, Q] = useState(""),
    [filter, F] = useState("All messages"),
    [modal, M] = useState(""),
    [edit, E] = useState<Row>({}),
    [detail, V] = useState<Row | null>(null),
    [notice, N] = useState(""),
    [busy, B] = useState(false),
    [password, P] = useState(""),
    [smtp, SP] = useState(""),
    [selected, Sel] = useState<string[]>([]),
    [rows, Rows] = useState<Row[]>([]),
    [rich, Rich] = useState(true),
    [mapping, Map] = useState({ name: "name", email: "email", phone: "phone", description: "description" });

  async function logout() {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) { N('Logout failed: ' + error.message + '. Please retry.'); return; }
    S(null); D({ messages: [], versions: [], recipients: [], connections: [], attempts: [] }); M(''); P(''); SP('');
  }
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      S(data.session);
      R(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => S(s));
    return () => data.subscription.unsubscribe();
  }, []);

  async function api(path: string, body?: unknown) {
    const {
      data: { session: s },
    } = await supabase.auth.getSession();
    if (!s) { S(null); throw Error('Your session has expired. Please log in again.'); }
    const res = await fetch("/api/" + path, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + s?.access_token },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const d = await res.json();
    if (res.status === 401) {
      await logout();
      S(null); D({ messages: [], versions: [], recipients: [], connections: [], attempts: [] }); M('');
      throw Error('Your session is no longer valid. Please log in again.');
    }
    if (!res.ok) throw Error(d.error || "Request failed");
    return d;
  }
  async function refresh() {
    try {
      D(await api("data"));
    } catch (e) {
      N((e as Error).message);
    }
  }
  useEffect(() => {
    if (session) refresh();
  }, [session?.user.id]);
  async function run(fn: () => Promise<void>) {
    B(true);
    N("");
    try {
      await fn();
    } catch (e) {
      N((e as Error).message);
    } finally {
      B(false);
    }
  }
  function open(name: string, value: Row = {}) {
    E(value);
    M(name);
    P("");
    SP("");
  }
  async function save(action: string, value: Row, id?: string) {
    const r = await api("data", { action, value, id });
    await refresh();
    return r.result;
  }
  function field(label: string, key: string, type = "text") {
    return (
      <label>
        {label}
        <input type={type} value={edit[key] || ""} onChange={(e) => E({ ...edit, [key]: e.target.value })} />
      </label>
    );
  }
  async function importFile(file: File) {
    if (file.size > 10_000_000) throw Error("Choose a file smaller than 10 MB");
    let values: Row[] = [];
    if (file.name.endsWith(".json")) {
      const json = JSON.parse(await file.text());
      if (!Array.isArray(json)) throw Error("JSON must be an array");
      values = json;
    } else if (file.name.endsWith(".csv")) {
      const parsed = Papa.parse<Row>(await file.text(), { header: true, skipEmptyLines: true });
      if (parsed.errors.length) throw Error(parsed.errors[0].message);
      values = parsed.data;
    } else {
      const ExcelJS = await import("exceljs");
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const sheet = wb.worksheets[0];
      if (!sheet) throw Error("No worksheet");
      const headers = (sheet.getRow(1).values as unknown[]).slice(1).map(String);
      sheet.eachRow((r, i) => {
        if (i > 1) {
          const row: Row = {};
          headers.forEach((h, j) => (row[h] = r.getCell(j + 1).text));
          values.push(row);
        }
      });
    }
    Rows(values);
    M("Import review");
  }
  async function send() {
    if (!detail) throw Error("Save the message first");
    if (!selected.length) throw Error("Select recipients");
    const requestId = crypto.randomUUID();
    let ok = 0,
      failed = 0;
    for (const id of selected) {
      N(`Sending ${ok + failed + 1} of ${selected.length}…`);
      const r = await api("send", { versionId: detail.id, recipientId: id, password, smtpPassword: smtp, requestId });
      if (r.status === "success") ok++;
      else failed++;
    }
    P("");
    SP("");
    M("");
    await refresh();
    N(`${ok} successful · ${failed} need review`);
  }
  if (!ready) return <main>Loading…</main>;
  if (!session)
    return (
      <main className="login">
        <section className="card">
          <h2>
            <FiSend /> Message Sender
          </h2>
          <h1>Welcome back</h1>
          <p>Sign in to your private messaging workspace.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                const { error } = await supabase.auth.signInWithPassword({ email: edit.email, password: edit.password });
                if (error) throw error;
              });
            }}
          >
            {field("Email", "email", "email")}
            {field("Password", "password", "password")}
            <button disabled={busy}>Log in</button>
          </form>
          {notice && <p role="alert">{notice}</p>}
          <small>Access is provided by your chief admin.</small>
        </section>
      </main>
    );
  const latest = (id: string) =>
    data.versions.filter((v: Row) => v.message_id === id).sort((a: Row, b: Row) => b.created_at.localeCompare(a.created_at))[0];
  return (
    <>
      <header>
        <strong>
          <FiSend /> Message Sender
        </strong>
        <nav>
          {[
            ["Messages", FiMail],
            ["Recipients", FiUsers],
            ["Settings", FiSettings],
          ].map(([name, Icon]: any) => (
            <button
              key={name}
              className={tab === name ? "active" : ""}
              onClick={() => {
                T(name);
                Q("");
                V(null);
              }}
            >
              <Icon />
              {name}
            </button>
          ))}
        </nav>
        <span>
          {data.member ? `${data.member.name} · ${data.member.role === "chief" ? "Chief admin" : "Admin"}` : "Account data unavailable"}
        </span>
        <button className="quiet" onClick={() => run(logout)}>
          Log out
        </button>
      </header>
      <main>
        <div className="heading">
          <h1>{tab}</h1>
          {tab === "Messages" && (
            <button
              onClick={() => {
                Sel([]);
                open("Compose", { channel: "email", title: "", subject: "", body: "", attachments: [] });
              }}
            >
              <FiPlus /> New message
            </button>
          )}
          {tab === "Recipients" && (
            <div className="actions">
              <button className="secondary" onClick={() => open("Import")}>
                <FiUpload /> Import
              </button>
              <button onClick={() => open("Recipient")}>
                <FiPlus /> Add recipient
              </button>
            </div>
          )}
        </div>
        {notice && (
          <div className="notice" role="status">
            {notice}
            <button className="quiet" aria-label="Dismiss" onClick={() => N("")}>
              <FiX />
            </button>
          </div>
        )}
        {tab === "Messages" && (
          <>
            <div className="stats">
              {[
                [data.messages.length, "Messages"],
                [data.attempts.filter((a: Row) => a.status === "success").length, "Successful"],
                [data.attempts.filter((a: Row) => ["failed", "unknown"].includes(a.status)).length, "Need review"],
              ].map(([v, l]) => (
                <div className="card" key={l}>
                  <b>{v}</b>
                  <small>{l}</small>
                </div>
              ))}
            </div>
            <label>
              Search
              <input placeholder="Search messages" value={query} onChange={(e) => Q(e.target.value)} />
            </label>
            <div className="filters">
              {["All messages", "Email", "SMS", "Drafts"].map((f) => (
                <button className={filter === f ? "chosen" : "quiet"} onClick={() => F(f)} key={f}>
                  {f}
                </button>
              ))}
            </div>
            {data.messages
              .filter(
                (m: Row) =>
                  m.title.toLowerCase().includes(query.toLowerCase()) &&
                  (filter === "All messages" ||
                    filter.toLowerCase() === m.channel ||
                    (filter === "Drafts" && !data.attempts.some((a: Row) => a.version_id === latest(m.id)?.id))),
              )
              .map((m: Row) => {
                const v = latest(m.id),
                  attempts = data.attempts.filter((a: Row) => a.version_id === v?.id);
                return (
                  <article className="card" key={m.id}>
                    <h3>
                      {m.channel === "email" ? <FiMail /> : <FiMessageSquare />}
                      {m.title}
                    </h3>
                    <p>
                      {m.channel.toUpperCase()} · {v?.recipient_ids.length || 0} recipients · {new Date(m.created_at).toLocaleString()}
                    </p>
                    <div className="actions">
                      <span className="badge">
                        {attempts.length ? `${attempts.filter((a: Row) => a.status === "success").length} successful` : "Draft"}
                      </span>
                      <button
                        className="secondary"
                        onClick={() => {
                          V(v);
                          Sel(v?.recipient_ids || []);
                          open("Details", m);
                        }}
                      >
                        Open
                      </button>
                    </div>
                  </article>
                );
              })}
            {!data.messages.length && (
              <section className="card">
                <h2>Start a conversation.</h2>
                <p>Create your first email or SMS.</p>
              </section>
            )}
          </>
        )}
        {tab === "Recipients" && (
          <>
            <label>
              Search recipients
              <input value={query} onChange={(e) => Q(e.target.value)} placeholder="Name, email or phone" />
            </label>
            {data.recipients
              .filter((r: Row) => JSON.stringify(r).toLowerCase().includes(query.toLowerCase()))
              .map((r: Row) => (
                <article className="card" key={r.id}>
                  <h3>{r.name || "Unnamed recipient"}</h3>
                  <p>
                    {r.email || "No email"}
                    <br />
                    {r.phone || "No phone"}
                  </p>
                  <small>{r.description}</small>
                  <button className="secondary" onClick={() => open("Recipient", r)}>
                    Edit recipient
                  </button>
                </article>
              ))}
          </>
        )}
        {tab === "Settings" && (
          <>
            <section className="card">
              <h2>Email senders</h2>
              {data.connections.filter((c: Row) => c.channel === "email").map((c: Row) => (
                <article className="connection" key={c.id}>
                  <h3>
                    {c.label} <span className="badge">{c.channel}</span>
                  </h3>
                  <p>
                    {c.channel === "email" ? `${c.config.user} · ${c.config.server}:${c.config.port}` : c.config.functionName + "(phone, message)"}
                  </p>
                  {(c.channel === "email" || data.member?.role === "chief") && (
                    <div className="actions">
                      <button className="secondary" onClick={() => open("Connection", { ...c, ...c.config })}>
                        Edit
                      </button>
                      <button
                        className="danger"
                        onClick={() => {
                          if (confirm("Delete this connection?"))
                            run(async () => {
                              await api("data", { action: "deleteConnection", id: c.id });
                              await refresh();
                            });
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </article>
              ))}
              <button onClick={() => open("Connection", { channel: "email", port: "587" })}>Add email sender</button>
            </section>
            <section className="card">
              <h2>My profile</h2>
              <p>{session.user.email}</p>
              <button className="secondary" onClick={() => open("Profile", { email: session.user.email })}>
                Update email or password
              </button>
            </section>
            {data.member?.role === "chief" && (
              <section className="card">
                <h2>Admins</h2>
                {data.members?.map((a: Row) => (
                  <p key={a.user_id}>
                    {a.name} · {a.role}
                  </p>
                ))}
                <button onClick={() => open("Admin")}>Add admin</button>
              </section>
            )}
          </>
        )}
      </main>
      {modal && (
        <div className="overlay">
          <section className={"dialog " + (modal === "Compose" ? "wide" : "")} role="dialog" aria-modal="true" aria-label={modal}>
            <div className="heading">
              <h2>{modal}</h2>
              <button className="quiet" aria-label="Close" disabled={busy} onClick={() => M("")}>
                <FiX />
              </button>
            </div>
            {modal === "Recipient" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    const r = await save("recipient", edit, edit.id);
                    Sel([...new Set([...selected, r.id])]);
                    M("");
                  });
                }}
              >
                {field("Name (optional)", "name")}
                {field("Email", "email", "email")}
                {field("Phone", "phone")}
                {field("Description", "description")}
                <small>Provide an email or phone number.</small>
                <button disabled={busy}>Save recipient</button>
              </form>
            )}
            {modal === "Import" && (
              <label className="drop">
                Choose JSON, CSV or Excel file
                <input
                  type="file"
                  accept=".json,.csv,.xlsx"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) run(() => importFile(f));
                  }}
                />
              </label>
            )}
            {modal === "Import review" && (
              <>
                <p>{rows.length} rows · first Excel worksheet</p>
                {Object.keys(mapping).map((k) => (
                  <label key={k}>
                    {k}
                    <select value={mapping[k as keyof typeof mapping]} onChange={(e) => Map({ ...mapping, [k]: e.target.value })}>
                      <option value="">Not mapped</option>
                      {[...new Set([...Object.keys(rows[0] || {}), k])].map((h) => (
                        <option key={h}>{h}</option>
                      ))}
                    </select>
                  </label>
                ))}
                <p>Missing contacts and split matches are skipped. Empty fields are filled; existing values are preserved.</p>
                <button
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const mapped = rows.map((r) => Object.fromEntries(Object.entries(mapping).map(([k, v]) => [k, r[v] || ""])));
                      const { result } = await api("data", { action: "import", rows: mapped });
                      Sel([...new Set([...selected, ...result.selected])]);
                      await refresh();
                      N(`${result.new} new · ${result.updated} updated · ${result.skipped} skipped · ${result.invalid} invalid`);
                      M("");
                    })
                  }
                >
                  Import & select
                </button>
              </>
            )}
            {modal === "Connection" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    await save(
                      "connection",
                      {
                        label: edit.label,
                        channel: "email",
                        config: { server: edit.server, port: edit.port, user: edit.user, fromName: edit.fromName, fromEmail: edit.fromEmail },
                      },
                      edit.id,
                    );
                    M("");
                  });
                }}
              >
                {field("Label", "label")}
                {field("SMTP server", "server")}
                {field("Port", "port", "number")}
                {field("Username", "user")}
                {field("From name", "fromName")}
                {field("From email", "fromEmail", "email")}
                <small>SMTP password is requested at send time and is never saved.</small>
                <button disabled={busy}>Save connection</button>
              </form>
            )}
            {modal === "Compose" && (
              <>
                <div className="compose">
                  <section>
                    {!edit.id && (
                      <label>
                        Channel
                        <select value={edit.channel} onChange={(e) => E({ ...edit, channel: e.target.value, connection_id: "" })}>
                          <option value="email">Email</option>
                          <option value="sms">SMS</option>
                        </select>
                      </label>
                    )}
                    {field("Internal title", "title")}
                    {edit.channel === "email" && <label>
                      Sender
                      <select value={edit.connection_id || ""} onChange={(e) => E({ ...edit, connection_id: e.target.value })}>
                        <option value="">Choose sender</option>
                        {data.connections
                          .filter((c: Row) => c.channel === edit.channel)
                          .map((c: Row) => (
                            <option key={c.id} value={c.id}>
                              {c.label}
                            </option>
                          ))}
                      </select>
                    </label>}
                    {edit.channel === "email" && field("Subject", "subject")}
                    {edit.channel === "email" && (
                      <div className="actions">
                        <button className="secondary" onClick={() => Rich(!rich)}>
                          {rich ? "Edit HTML" : "Rich text"}
                        </button>
                        {rich &&
                          ["bold", "italic", "underline", "insertUnorderedList"].map((cmd) => (
                            <button key={cmd} className="quiet" onMouseDown={(e) => e.preventDefault()} onClick={() => document.execCommand(cmd)}>
                              {cmd}
                            </button>
                          ))}
                      </div>
                    )}
                    {edit.channel === "email" && rich ? (
                      <div
                        className="rich-editor"
                        contentEditable
                        suppressContentEditableWarning
                        role="textbox"
                        aria-label="Email body"
                        ref={(el) => {
                          if (el && document.activeElement !== el && el.innerHTML !== (edit.body || ""))
                            el.innerHTML = DOMPurify.sanitize(edit.body || "");
                        }}
                        onInput={(e) => E({ ...edit, body: e.currentTarget.innerHTML })}
                      />
                    ) : (
                      <label>
                        Message
                        <textarea rows={12} value={edit.body || ""} onChange={(e) => E({ ...edit, body: e.target.value })} />
                      </label>
                    )}
                    <small>
                      Personalize with {"{{name}}"} · {edit.body?.length || 0} characters
                    </small>
                    {edit.channel === "email" && (
                      <>
                        <label>
                          Attachments (5 MB total)
                          <input
                            type="file"
                            multiple
                            onChange={(e) =>
                              run(async () => {
                                const files = Array.from(e.target.files || []);
                                if (files.reduce((n, f) => n + f.size, 0) > 5_000_000) throw Error("Maximum 5 MB");
                                const attachments = await Promise.all(
                                  files.map(
                                    (f) =>
                                      new Promise((resolve, reject) => {
                                        const reader = new FileReader();
                                        reader.onload = () => resolve({ name: f.name, content: String(reader.result).split(",")[1] });
                                        reader.onerror = reject;
                                        reader.readAsDataURL(f);
                                      }),
                                  ),
                                );
                                E({ ...edit, attachments });
                              })
                            }
                          />
                        </label>
                        {edit.attachments?.map((a: Row) => (
                          <small key={a.name}>{a.name}</small>
                        ))}
                        <details>
                          <summary>Email preview</summary>
                          <iframe title="Email preview" sandbox="" srcDoc={edit.body || ""} />
                        </details>
                      </>
                    )}
                  </section>
                  <aside>
                    <h3>Recipients · {selected.length} selected</h3>
                    <p>Each person receives a separate message.</p>
                    {data.recipients.map((r: Row) => (
                      <label className="check" key={r.id}>
                        <input
                          type="checkbox"
                          checked={selected.includes(r.id)}
                          disabled={!r[edit.channel === "email" ? "email" : "phone"]}
                          onChange={(e) => Sel(e.target.checked ? [...selected, r.id] : selected.filter((id) => id !== r.id))}
                        />
                        <span>
                          {r.name || r.email || r.phone}
                          <small>{r[edit.channel === "email" ? "email" : "phone"] || "Missing contact"}</small>
                        </span>
                      </label>
                    ))}
                  </aside>
                </div>
                <button
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const v = await save("message", { ...edit, recipient_ids: selected }, edit.id);
                      V(v);
                      M("Confirm send");
                    })
                  }
                >
                  Save version & review
                </button>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await save("message", { ...edit, recipient_ids: selected }, edit.id);
                      M("");
                      N("Draft saved");
                    })
                  }
                >
                  Save draft
                </button>
              </>
            )}
            {modal === "Details" && detail && (
              <>
                <p>{edit.title}</p>
                <label>
                  Version
                  <select
                    value={detail.id}
                    onChange={(e) => {
                      const v = data.versions.find((v: Row) => v.id === e.target.value);
                      V(v);
                      Sel(v.recipient_ids);
                    }}
                  >
                    {data.versions
                      .filter((v: Row) => v.message_id === edit.id)
                      .map((v: Row) => (
                        <option key={v.id} value={v.id}>
                          {new Date(v.created_at).toLocaleString()}
                        </option>
                      ))}
                  </select>
                </label>
                <h3>{detail.subject}</h3>
                <iframe title="Message content" sandbox="" srcDoc={detail.body} />
                <div className="actions">
                  <button
                    onClick={() => {
                      Sel(detail.recipient_ids);
                      M("Confirm send");
                    }}
                  >
                    Resend to all
                  </button>
                  <button
                    className="secondary"
                    onClick={() => {
                      Sel([]);
                      M("Send to others");
                    }}
                  >
                    Send to others
                  </button>
                  <button
                    className="secondary"
                    onClick={() => {
                      E({ ...edit, ...detail, id: edit.id, channel: edit.channel });
                      M("Compose");
                    }}
                  >
                    Edit as new version
                  </button>
                </div>
                {data.attempts
                  .filter((a: Row) => a.version_id === detail.id)
                  .map((a: Row) => (
                    <article className="connection" key={a.id}>
                      <b>{a.destination}</b>
                      <p>
                        {a.status} · {a.error || new Date(a.created_at).toLocaleString()}
                      </p>
                      <button
                        className="secondary"
                        onClick={() => {
                          Sel([a.recipient_id]);
                          M("Confirm send");
                        }}
                      >
                        Resend
                      </button>
                    </article>
                  ))}
              </>
            )}
            {modal === "Send to others" && (
              <>
                {data.recipients.map((r: Row) => (
                  <label className="check" key={r.id}>
                    <input
                      type="checkbox"
                      checked={selected.includes(r.id)}
                      onChange={(e) => Sel(e.target.checked ? [...selected, r.id] : selected.filter((x) => x !== r.id))}
                    />
                    {r.name || r.email || r.phone}
                  </label>
                ))}
                <button onClick={() => M("Confirm send")}>Review & send</button>
              </>
            )}
            {modal === "Confirm send" && (
              <>
                <p>Send this saved version to {selected.length} recipients? Previous recipients will receive another copy.</p>
                <label>
                  Your login password
                  <input type="password" autoComplete="current-password" value={password} onChange={(e) => P(e.target.value)} />
                </label>
                {data.messages.find((m: Row) => m.id === detail?.message_id)?.channel === "email" && <label>
                  SMTP password
                  <input type="password" autoComplete="off" value={smtp} onChange={(e) => SP(e.target.value)} />
                </label>}
                <button disabled={busy || !password || !selected.length} onClick={() => run(send)}>
                  {busy ? "Sending…" : "Confirm & send"}
                </button>
                <p>Keep this window open until all recipients are processed.</p>
              </>
            )}
            {modal === "Admin" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    await api("data", { action: "admin", ...edit });
                    M("");
                    await refresh();
                  });
                }}
              >
                {field("Name", "name")}
                {field("Email", "email", "email")}
                {field("Temporary password", "password", "password")}
                <button disabled={busy}>Add admin</button>
              </form>
            )}
            {modal === "Profile" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    const { error } = await supabase.auth.updateUser({ email: edit.email, ...(edit.password ? { password: edit.password } : {}) });
                    if (error) throw error;
                    M("");
                    N("Profile updated. Check your email if confirmation is required.");
                  });
                }}
              >
                {field("Email", "email", "email")}
                {field("New password", "password", "password")}
                <button disabled={busy}>Update profile</button>
              </form>
            )}
            {notice && <p role="status">{notice}</p>}
          </section>
        </div>
      )}
    </>
  );
}
