// Netlify serverless Notion proxy for Command Center.
// Holds NOTION_TOKEN server-side; emulates the MCP output shapes the client expects.

const NOTION_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2025-09-03";
const STATE_PAGE_ID = "37478f3d-415b-814c-8c65-dd76b6ab9aa3";

// --- per-data-source schema (name -> Notion type). Used for WRITES only. ---
const DS_SCHEMAS = {
  // Tasks
  "fb432308-59b9-4078-92db-a83c6279957d": {
    Task: "title", Area: "select", Done: "checkbox", Priority: "checkbox",
    Notes: "rich_text", Created: "date", "Due Date": "date",
    Energy: "select", "Time Estimate": "select",
  },
  // Wins
  "f99a9128-9809-48b9-9cb6-870717bd5183": {
    Win: "title", Date: "date",
  },
  // Routines
  "17f7f036-e24c-40ce-9d41-db5d8a66b618": {
    Routine: "title", Active: "checkbox", "Done Today": "checkbox", Order: "number",
    "Time Of Day": "select", "Last Done": "date", "Streak Count": "number",
  },
  // Capture
  "35ba4e31-eca6-4ab7-8625-acc41d5341e8": {
    Item: "title", Captured: "date", Processed: "checkbox", Notes: "rich_text",
  },
  // Focus Sessions
  "291cb585-746e-4195-a920-b0ac460fbbf6": {
    Session: "title", Date: "date", Minutes: "number", Type: "select", Task: "rich_text",
  },
};

// Union fallback used when no/unknown data source id is supplied on a write.
const PROP_TYPES = (() => {
  const m = {};
  for (const ds of Object.values(DS_SCHEMAS)) {
    for (const [name, type] of Object.entries(ds)) {
      if (!(name in m)) m[name] = type;
    }
  }
  return m;
})();

function richTextPlain(rt) {
  if (!Array.isArray(rt)) return "";
  return rt.map((t) => (t && (t.plain_text != null ? t.plain_text : (t.text && t.text.content) || ""))).join("");
}

// ---- pure helpers (exported for tests) ----

export function parseDataSourceUrl(url) {
  if (!url) return "";
  return String(url).replace(/^collection:\/\//, "");
}

export function extractJsonFence(markdown) {
  if (!markdown) return "";
  const m = String(markdown).match(/```json\s*([\s\S]*?)```/);
  if (m) return m[1].trim();
  // fallback: any fenced block
  const m2 = String(markdown).match(/```\s*([\s\S]*?)```/);
  return m2 ? m2[1].trim() : "";
}

// REST page.properties -> MCP <properties> object (READS).
export function encodePropsToMcp(restProps) {
  const out = {};
  if (!restProps) return out;
  for (const [name, prop] of Object.entries(restProps)) {
    if (!prop || !prop.type) continue;
    switch (prop.type) {
      case "title":
        out[name] = richTextPlain(prop.title);
        if (!("title" in out)) out.title = out[name]; // p.title fallback for client
        break;
      case "rich_text":
        out[name] = richTextPlain(prop.rich_text);
        break;
      case "select":
        out[name] = prop.select ? prop.select.name : "";
        break;
      case "checkbox":
        out[name] = prop.checkbox ? "__YES__" : "__NO__";
        break;
      case "number":
        out[name] = prop.number;
        break;
      case "date":
        if (prop.date && prop.date.start != null) out["date:" + name + ":start"] = prop.date.start;
        break;
      default:
        break;
    }
  }
  return out;
}

// MCP encoding -> REST property objects (WRITES). dataSourceId picks the schema.
export function mcpPropsToRest(mcpProps, dataSourceId) {
  const schema = (dataSourceId && DS_SCHEMAS[dataSourceId]) || PROP_TYPES;
  const out = {};
  for (const [key, value] of Object.entries(mcpProps || {})) {
    // Date encoding: "date:Name:start"
    const dm = key.match(/^date:(.+):start$/);
    if (dm) {
      const name = dm[1];
      out[name] = { date: value ? { start: value } : null };
      continue;
    }
    const type = schema[key] || PROP_TYPES[key] || "rich_text";
    switch (type) {
      case "title":
        out[key] = { title: [{ type: "text", text: { content: String(value) } }] };
        break;
      case "select":
        out[key] = { select: value ? { name: String(value) } : null };
        break;
      case "checkbox":
        out[key] = { checkbox: value === "__YES__" };
        break;
      case "number":
        out[key] = { number: value };
        break;
      case "rich_text":
      default:
        out[key] = { rich_text: [{ type: "text", text: { content: String(value) } }] };
        break;
    }
  }
  return out;
}

function suffix(name) {
  const parts = String(name).split("__");
  return parts[parts.length - 1];
}

function notionHeaders() {
  const token = process.env.NOTION_TOKEN;
  return {
    Authorization: "Bearer " + token,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

async function notionReq(fetchImpl, method, path, body) {
  const opts = { method, headers: notionHeaders() };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetchImpl(NOTION_BASE + path, opts);
  let data = null;
  try {
    data = await res.json();
  } catch (_) {
    data = null;
  }
  if (!res.ok) {
    const msg = (data && data.message) || ("notion error " + res.status);
    const err = new Error(msg);
    err.statusCode = res.status >= 400 && res.status < 600 ? res.status : 502;
    throw err;
  }
  return data;
}

// ---- core dispatch (injectable fetchImpl) ----
export async function dispatch({ name, args, fetchImpl }) {
  const f = fetchImpl || globalThis.fetch;
  const op = suffix(name);
  args = args || {};

  switch (op) {
    case "notion-fetch": {
      const id = args.id;
      if (id === STATE_PAGE_ID) {
        const children = await notionReq(f, "GET", "/blocks/" + id + "/children?page_size=100");
        const codeBlock = (children.results || []).find((b) => b.type === "code");
        const codeText = codeBlock ? richTextPlain(codeBlock.code.rich_text) : "";
        return { content: [{ type: "text", text: "```json\n" + codeText + "\n```" }] };
      }
      const page = await notionReq(f, "GET", "/pages/" + id);
      const mcp = encodePropsToMcp(page.properties);
      return {
        content: [{ type: "text", text: "<properties>" + JSON.stringify(mcp) + "</properties>" }],
      };
    }

    case "notion-search": {
      const dsId = parseDataSourceUrl(args.data_source_url);
      const pageSize = args.page_size || 100;
      const data = await notionReq(f, "POST", "/data_sources/" + dsId + "/query", { page_size: pageSize });
      const results = (data.results || []).slice(0, pageSize).map((pg) => {
        let title = "";
        for (const prop of Object.values(pg.properties || {})) {
          if (prop && prop.type === "title") {
            title = richTextPlain(prop.title);
            break;
          }
        }
        return { id: pg.id, title };
      });
      return { results };
    }

    case "notion-update-page": {
      if (args.command === "update_content") {
        const upd = (args.content_updates && args.content_updates[0]) || {};
        const newJson = extractJsonFence(upd.new_str);
        const children = await notionReq(f, "GET", "/blocks/" + args.page_id + "/children?page_size=100");
        const codeBlock = (children.results || []).find((b) => b.type === "code");
        if (!codeBlock) {
          const err = new Error("no code block on state page");
          err.statusCode = 404;
          throw err;
        }
        await notionReq(f, "PATCH", "/blocks/" + codeBlock.id, {
          code: { rich_text: [{ type: "text", text: { content: newJson } }] },
        });
        return { ok: true };
      }
      // update_properties
      const rest = mcpPropsToRest(args.properties, null);
      await notionReq(f, "PATCH", "/pages/" + args.page_id, { properties: rest });
      return { ok: true };
    }

    case "notion-create-pages": {
      const dsId = args.parent && args.parent.data_source_id;
      const pages = [];
      for (const entry of args.pages || []) {
        const rest = mcpPropsToRest(entry.properties, dsId);
        const created = await notionReq(f, "POST", "/pages", {
          parent: { type: "data_source_id", data_source_id: dsId },
          properties: rest,
        });
        pages.push({ id: created.id });
      }
      return { pages };
    }

    default: {
      const err = new Error("unknown op: not allowed");
      err.statusCode = 400;
      throw err;
    }
  }
}

// ---- Netlify handler ----
function corsHeaders(event) {
  const headers = { "Content-Type": "application/json" };
  const h = event.headers || {};
  const origin = h.origin || h.Origin;
  const host = h.host || h.Host;
  if (origin && host) {
    let originHost = origin;
    try {
      originHost = new URL(origin).host;
    } catch (_) {}
    if (originHost === host) {
      headers["Access-Control-Allow-Origin"] = origin;
      headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
      headers["Access-Control-Allow-Headers"] = "Content-Type";
    }
  }
  return headers;
}

export const handler = async (event) => {
  const headers = corsHeaders(event);
  const method = event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method);

  if (method === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }
  if (method !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "method not allowed" }) };
  }
  if (!process.env.NOTION_TOKEN) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "server not configured" }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (_) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "invalid JSON body" }) };
  }

  const op = suffix(payload.name || "");
  const allowed = ["notion-fetch", "notion-search", "notion-update-page", "notion-create-pages"];
  if (!allowed.includes(op)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "operation not allowed" }) };
  }

  try {
    const result = await dispatch({ name: payload.name, args: payload.args });
    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (e) {
    const statusCode = e.statusCode || 500;
    return { statusCode, headers, body: JSON.stringify({ error: String(e.message || e) }) };
  }
};
