import { dbojs } from "../../services/Database/index.ts";
import { broadcast } from "../../services/broadcast/index.ts";
import { boards, posts, getNextPostId } from "./db.ts";
import type { IBoard, IPost } from "./db.ts";

// ─── helpers ─────────────────────────────────────────────────────────────────

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

async function isStaffUser(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const player = await dbojs.queryOne({ id: userId });
  if (!player) return false;
  const flags = player.flags || "";
  return flags.includes("admin") || flags.includes("wizard") || flags.includes("superuser");
}

async function canReadBoard(board: IBoard, userId: string): Promise<boolean> {
  if (board.readLock === "all()" || !board.readLock) return true;
  return await isStaffUser(userId);
}

async function canWriteBoard(board: IBoard, userId: string): Promise<boolean> {
  if (board.writeLock === "all()" || !board.writeLock) return true;
  return await isStaffUser(userId);
}

async function getNewCountForUser(
  boardNum: number,
  userId: string
): Promise<number> {
  const player = await dbojs.queryOne({ id: userId });
  const lastRead = ((player && player.data?.bbLastRead) as Record<string, number>) || {};
  const lastReadNum = lastRead[String(boardNum)] || 0;
  const allPosts = await posts.query({ boardId: boardNum });
  return allPosts.filter((p) => p.num > lastReadNum).length;
}

// ─── route handler ────────────────────────────────────────────────────────────

export async function bboardsRouteHandler(
  req: Request,
  userId: string | null
): Promise<Response> {
  const url    = new URL(req.url);
  const path   = url.pathname;
  const method = req.method;

  // Public boards (1, 2, 3, 11) are readable without auth
  const PUBLIC_BOARDS = new Set([1, 2, 3, 11]);
  const isPublicRead = method === "GET" && !userId;

  // ── GET /api/v1/boards ───────────────────────────────────────────────────
  if (path === "/api/v1/boards" && method === "GET") {
    const all = await boards.query({});
    all.sort((a, b) => a.num - b.num);

    // Filter: logged-in users see boards they can read; anonymous see public boards only
    const visible: IBoard[] = [];
    for (const b of all) {
      if (userId) {
        if (await canReadBoard(b, userId)) visible.push(b);
      } else if (PUBLIC_BOARDS.has(b.num)) {
        visible.push(b);
      }
    }

    const result = await Promise.all(
      visible.map(async (b) => {
        const boardPosts = await posts.query({ boardId: b.num });
        const newCount = userId ? await getNewCountForUser(b.num, userId) : 0;
        return { ...b, postCount: boardPosts.length, newCount };
      })
    );

    return jsonResponse(result);
  }

  // All non-GET requests require auth
  if (!userId && method !== "GET") return jsonResponse({ error: "Unauthorized" }, 401);

  // ── POST /api/v1/boards ──────────────────────────────────────────────────
  if (path === "/api/v1/boards" && method === "POST") {
    const staff = await isStaffUser(userId);
    if (!staff) return jsonResponse({ error: "Forbidden" }, 403);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const title = typeof body.name === "string" ? body.name.trim().slice(0, 40) : "";
    if (!title) return jsonResponse({ error: "name is required" }, 400);

    const allBoards = await boards.query({});
    const rawNum = typeof body.order === "number" ? body.order : allBoards.length + 1;
    const num = Math.max(1, Math.floor(rawNum));

    const existing = await boards.queryOne({ num });
    if (existing) return jsonResponse({ error: "Board already exists" }, 409);

    const id = `board-${num}`;
    const readLock  = typeof body.readLock  === "string" ? body.readLock  : "";
    const writeLock = typeof body.writeLock === "string" ? body.writeLock : "";

    const board: IBoard = {
      id,
      num,
      title,
      timeout: 0,
      anonymous: false,
      readLock,
      writeLock,
      pendingDelete: false,
    };
    await boards.create(board);
    return jsonResponse(board, 201);
  }

  // ── GET /api/v1/boards/unread ────────────────────────────────────────────
  // IMPORTANT: This must come BEFORE the /api/v1/boards/:id regex match below,
  // otherwise "unread" would be treated as a board ID.
  if (path === "/api/v1/boards/unread" && method === "GET" && userId) {
    const all = await boards.query({});
    const entries: Array<{ boardId: string; boardName: string; newCount: number }> = [];
    for (const b of all) {
      if (!(await canReadBoard(b, userId))) continue;
      entries.push({
        boardId: b.id,
        boardName: b.title,
        newCount: await getNewCountForUser(b.num, userId),
      });
    }
    const total = entries.reduce((sum, r) => sum + r.newCount, 0);
    return jsonResponse({ total, boards: entries.filter((r) => r.newCount > 0) });
  }

  // ── board by :id sub-routes ──────────────────────────────────────────────
  const boardMatch = path.match(/^\/api\/v1\/boards\/([^/]+)(\/posts(?:\/(\d+)(?:\/replies(?:\/(\d+))?)?)?|\/read)?$/);
  if (boardMatch) {
    const boardId  = boardMatch[1];
    const sub      = boardMatch[2] || "";
    const postNum  = boardMatch[3] ? parseInt(boardMatch[3], 10) : NaN;
    const replyNum = boardMatch[4] ? parseInt(boardMatch[4], 10) : NaN;

    // Try to find board by numeric id or string id
    const boardNum = parseInt(boardId, 10);
    const board = !isNaN(boardNum)
      ? await boards.queryOne({ num: boardNum })
      : await boards.queryOne({ id: boardId });
    if (!board) return jsonResponse({ error: "Board not found" }, 404);

    // ── GET /api/v1/boards/:id ─────────────────────────────────────────────
    if (!sub && method === "GET") {
      if (!userId && !PUBLIC_BOARDS.has(board.num)) return jsonResponse({ error: "Unauthorized" }, 401);
      if (userId && !(await canReadBoard(board, userId))) return jsonResponse({ error: "Forbidden" }, 403);
      const boardPosts = await posts.query({ boardId: board.num });
      const newCount = await getNewCountForUser(board.num, userId);
      return jsonResponse({ ...board, postCount: boardPosts.length, newCount });
    }

    // ── PATCH /api/v1/boards/:id ───────────────────────────────────────────
    if (!sub && method === "PATCH") {
      const staff = await isStaffUser(userId);
      if (!staff) return jsonResponse({ error: "Forbidden" }, 403);

      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return jsonResponse({ error: "Invalid JSON body" }, 400);
      }

      const update: Partial<IBoard> = {};
      if (typeof body.title === "string") update.title = body.title.trim().slice(0, 40);
      if (typeof body.timeout === "number") update.timeout = Math.max(0, Math.floor(body.timeout));
      if (typeof body.anonymous === "boolean") update.anonymous = body.anonymous;
      if (typeof body.readLock === "string") update.readLock = body.readLock;
      if (typeof body.writeLock === "string") update.writeLock = body.writeLock;
      const updated: IBoard = { ...board, ...update };
      await boards.update({ id: board.id }, updated);
      return jsonResponse(updated);
    }

    // ── DELETE /api/v1/boards/:id ──────────────────────────────────────────
    if (!sub && method === "DELETE") {
      const staff = await isStaffUser(userId);
      if (!staff) return jsonResponse({ error: "Forbidden" }, 403);

      await boards.delete({ id: board.id });
      await posts.delete({ boardId: board.num });
      return jsonResponse({ deleted: true });
    }

    // ── GET /api/v1/boards/:id/posts ───────────────────────────────────────
    if (sub === "/posts" && method === "GET") {
      if (!userId && !PUBLIC_BOARDS.has(board.num)) return jsonResponse({ error: "Unauthorized" }, 401);
      if (userId && !(await canReadBoard(board, userId))) return jsonResponse({ error: "Forbidden" }, 403);
      const params = url.searchParams;
      const limit  = Math.min(parseInt(params.get("limit")  || "50", 10), 200);
      const offset = Math.max(parseInt(params.get("offset") || "0",  10), 0);

      const boardPosts = await posts.query({ boardId: board.num });
      boardPosts.sort((a, b) => a.num - b.num);
      const page = boardPosts.slice(offset, offset + limit);
      return jsonResponse({ total: boardPosts.length, posts: page });
    }

    // ── POST /api/v1/boards/:id/posts ──────────────────────────────────────
    if (sub === "/posts" && method === "POST") {
      if (!(await canWriteBoard(board, userId))) return jsonResponse({ error: "Forbidden" }, 403);
      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return jsonResponse({ error: "Invalid JSON body" }, 400);
      }

      const subject = typeof body.subject === "string" ? body.subject.trim().slice(0, 60) : "";
      const postBody  = typeof body.body    === "string" ? body.body.trim()    : "";
      if (!subject || !postBody) return jsonResponse({ error: "subject and body are required" }, 400);

      const player = await dbojs.queryOne({ id: userId });
      const authorName = (player && player.data?.name) || userId;

      const allPosts = await posts.query({ boardId: board.num });
      const num = allPosts.length > 0
        ? Math.max(...allPosts.map((p) => p.num)) + 1
        : 1;
      const globalId = await getNextPostId();
      const id  = `bbpost-${globalId}`;

      const post: IPost = {
        id,
        boardId: board.num,
        num,
        globalId,
        subject,
        body: postBody,
        authorId: userId,
        authorName: String(authorName),
        createdAt: Date.now(),
        timeout: 0,
        editCount: 0,
        replies: [],
      };

      await posts.create(post);
      broadcast(`%ch>BBS:%cn New post on ${board.title} (#${board.num}/${num}) by ${post.authorName}: ${subject}`);
      return jsonResponse(post, 201);
    }

    // ── GET /api/v1/boards/:id/posts/:num ─────────────────────────────────
    if (sub.startsWith("/posts/") && !sub.includes("/replies") && !isNaN(postNum) && method === "GET") {
      if (!userId && !PUBLIC_BOARDS.has(board.num)) return jsonResponse({ error: "Unauthorized" }, 401);
      if (userId && !(await canReadBoard(board, userId))) return jsonResponse({ error: "Forbidden" }, 403);
      const post = await posts.queryOne({ boardId: board.num, num: postNum });
      if (!post) return jsonResponse({ error: "Post not found" }, 404);
      return jsonResponse(post);
    }

    // ── PATCH /api/v1/boards/:id/posts/:num ────────────────────────────────
    if (sub.startsWith("/posts/") && !sub.includes("/replies") && !isNaN(postNum) && method === "PATCH") {
      const post = await posts.queryOne({ boardId: board.num, num: postNum });
      if (!post) return jsonResponse({ error: "Post not found" }, 404);

      const staff = await isStaffUser(userId);
      if (post.authorId !== userId && !staff) return jsonResponse({ error: "Forbidden" }, 403);

      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return jsonResponse({ error: "Invalid JSON body" }, 400);
      }

      const newBody    = typeof body.body    === "string" ? body.body.trim()    : post.body;
      const newSubject = typeof body.subject === "string" ? body.subject.trim().slice(0, 60) : post.subject;

      const updated: IPost = { ...post, body: newBody, subject: newSubject, editCount: post.editCount + 1 };
      await posts.update({ id: post.id }, updated);
      return jsonResponse(updated);
    }

    // ── DELETE /api/v1/boards/:id/posts/:num ──────────────────────────────
    if (sub.startsWith("/posts/") && !sub.includes("/replies") && !isNaN(postNum) && method === "DELETE") {
      const post = await posts.queryOne({ boardId: board.num, num: postNum });
      if (!post) return jsonResponse({ error: "Post not found" }, 404);

      const staff = await isStaffUser(userId);
      if (post.authorId !== userId && !staff) return jsonResponse({ error: "Forbidden" }, 403);

      await posts.delete({ id: post.id });
      return jsonResponse({ deleted: true });
    }

    // ── POST /api/v1/boards/:id/posts/:num/replies ────────────────────────
    if (sub.includes("/replies") && !isNaN(postNum) && isNaN(replyNum) && method === "POST") {
      if (!userId) return jsonResponse({ error: "Unauthorized" }, 401);
      if (!(await canWriteBoard(board, userId))) return jsonResponse({ error: "Forbidden" }, 403);

      const post = await posts.queryOne({ boardId: board.num, num: postNum });
      if (!post) return jsonResponse({ error: "Post not found" }, 404);

      let body: Record<string, unknown>;
      try { body = await req.json(); } catch { return jsonResponse({ error: "Invalid JSON body" }, 400); }

      const replyBody = typeof body.body === "string" ? body.body.trim() : "";
      if (!replyBody) return jsonResponse({ error: "body is required" }, 400);

      const player = await dbojs.queryOne({ id: userId });
      const authorName = (player && player.data?.name) || userId;

      const replies = post.replies || [];
      const num = replies.length > 0 ? Math.max(...replies.map((r) => r.num)) + 1 : 1;

      const reply = {
        num,
        subject: `Re: ${post.subject}`,
        body: replyBody,
        authorId: userId,
        authorName: String(authorName),
        createdAt: Date.now(),
        editCount: 0,
      };

      replies.push(reply);
      const updated = { ...post, replies };
      await posts.update({ id: post.id }, updated);
      broadcast(`%ch>BBS:%cn New reply on ${board.title} (#${board.num}/${post.num}) by ${reply.authorName}: Re: ${post.subject}`);
      return jsonResponse(reply, 201);
    }

    // ── PATCH /api/v1/boards/:id/posts/:num/replies/:rnum ───────────────
    if (sub.includes("/replies/") && !isNaN(postNum) && !isNaN(replyNum) && method === "PATCH") {
      if (!userId) return jsonResponse({ error: "Unauthorized" }, 401);
      const post = await posts.queryOne({ boardId: board.num, num: postNum });
      if (!post) return jsonResponse({ error: "Post not found" }, 404);

      const replies = post.replies || [];
      const reply = replies.find((r) => r.num === replyNum);
      if (!reply) return jsonResponse({ error: "Reply not found" }, 404);

      const staff = await isStaffUser(userId);
      if (reply.authorId !== userId && !staff) return jsonResponse({ error: "Forbidden" }, 403);

      let body: Record<string, unknown>;
      try { body = await req.json(); } catch { return jsonResponse({ error: "Invalid JSON body" }, 400); }

      if (typeof body.body === "string") reply.body = body.body.trim();
      reply.editCount = (reply.editCount || 0) + 1;

      const updated = { ...post, replies };
      await posts.update({ id: post.id }, updated);
      return jsonResponse(reply);
    }

    // ── DELETE /api/v1/boards/:id/posts/:num/replies/:rnum ──────────────
    if (sub.includes("/replies/") && !isNaN(postNum) && !isNaN(replyNum) && method === "DELETE") {
      if (!userId) return jsonResponse({ error: "Unauthorized" }, 401);
      const post = await posts.queryOne({ boardId: board.num, num: postNum });
      if (!post) return jsonResponse({ error: "Post not found" }, 404);

      const replies = post.replies || [];
      const reply = replies.find((r) => r.num === replyNum);
      if (!reply) return jsonResponse({ error: "Reply not found" }, 404);

      const staff = await isStaffUser(userId);
      if (reply.authorId !== userId && !staff) return jsonResponse({ error: "Forbidden" }, 403);

      const filtered = replies.filter((r) => r.num !== replyNum);
      const updated = { ...post, replies: filtered };
      await posts.update({ id: post.id }, updated);
      return jsonResponse({ deleted: true });
    }

    // ── POST /api/v1/boards/:id/read ──────────────────────────────────────
    if (sub === "/read" && method === "POST") {
      const boardPosts = await posts.query({ boardId: board.num });
      const maxNum = boardPosts.reduce((m, p) => Math.max(m, p.num), 0);

      const player = await dbojs.queryOne({ id: userId });
      if (player) {
        const lastRead = ((player.data?.bbLastRead) as Record<string, number>) || {};
        lastRead[String(board.num)] = maxNum;
        await dbojs.modify({ id: player.id }, "$set", { "data.bbLastRead": lastRead } as Partial<typeof player>);
      }

      return jsonResponse({ boardId: board.id, lastRead: maxNum });
    }
  }

  return jsonResponse({ error: "Not Found" }, 404);
}
