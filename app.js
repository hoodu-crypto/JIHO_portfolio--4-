const $ = selector => document.querySelector(selector);
const page = $("#page");
const viewer = $("#viewer");
const login = $("#login");
const preview = $("#preview");
const viewport = $("#viewport");
const config = window.JIHO_CONFIG;
const t = (ko, en) => lang === "ko" ? ko : en;
const localized = (item, field) => item[field] ?? (item[field + "_" + lang] || item[field + "_" + (lang === "ko" ? "en" : "ko")] || "");
let lang = "ko";
let client;
let owner;
let draft;
let revision = 0;
let saving = false;
let scale = 1;
let drag;
let position = [0, 0];
let gestureScale = null;
let message = "";
const uploads = new Map();
const flipped = new Set();

const publishedDemo = {
  home: { featured: ["blue", "still", "field", "form"], prints: [
    { image: "./images/window.jpg", title_ko: "창가의 빛", title_en: "Window Light" },
    { image: "./images/coast.jpg", title_ko: "해안선", title_en: "Coastline" }
  ] },
  projects: [
    ["blue", "푸른 습작", "Blue Study"],
    ["still", "정물", "Still Life"],
    ["field", "관찰 노트", "Field Notes"],
    ["form", "형태 연구", "Form Study"]
  ].map(([id, title_ko, title_en]) => ({
    id, title_ko, title_en, cover: "./images/" + id + ".jpg", photos: [],
    text_ko: "", text_en: ""
  })),
  about: { image: "", text_ko: "", text_en: "", email: "" }
};
let published = publishedDemo;

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function button(text, action, className) {
  const node = el("button", text, className);
  node.type = "button";
  node.addEventListener("click", action);
  return node;
}

function link(text, href) {
  const node = el("a", text);
  node.href = href;
  return node;
}

function image(src, alt = "") {
  const node = el("img");
  node.src = src;
  node.alt = alt;
  return node;
}

function linkTo(item) {
  return "#/project/" + item.id;
}

function render() {
  const path = location.hash.slice(1).split("/");
  const section = path[1] || "";
  const data = draft || published;
  document.documentElement.lang = lang;
  $("#nav").setAttribute("aria-label", t("주 메뉴", "Main navigation"));
  $("#nav").replaceChildren(...[
    ["", t("홈", "Home")], ["work", t("전체 작품", "Work")], ["about", t("소개", "About")]
  ].map(([route, label]) => {
    const node = link(label, "#/" + route);
    if (route === section || route === "work" && section === "project") node.setAttribute("aria-current", "page");
    return node;
  }));
  $("#languages").replaceChildren(...[["ko", "한국어"], ["en", "EN"]].map(([code, label]) => {
    const node = button(label, () => { lang = code; render(); });
    node.setAttribute("aria-pressed", String(code === lang));
    return node;
  }));
  page.replaceChildren();
  if (section === "work") renderWork(data);
  else if (section === "project") renderProject(data.projects.find(item => item.id === path[2]));
  else if (section === "about") renderAbout(data.about);
  else renderHome(data);

  const footer = $("#footer");
  const status = el("span", message);
  status.setAttribute("role", "status");
  if (!owner) {
    footer.replaceChildren(button(t("관리자 로그인", "Owner sign in"), openLogin), status);
  } else {
    const mode = draft
      ? [
          button(t("저장 및 공개", "Save & publish"), publish),
          button(t("편집 취소", "Discard edits"), discard)
        ]
      : [button(t("편집 시작", "Edit site"), () => { draft = structuredClone(published); render(); })];
    footer.replaceChildren(...mode, button(t("로그아웃", "Sign out"), signOut), status);
  }
  document.body.inert = saving;
  $("#login-title").textContent = t("관리자 로그인", "Owner sign in");
  $("#sign-in").textContent = t("로그인", "Sign in");
  $("#close-login").textContent = t("닫기", "Close");
  $("#close-viewer").textContent = t("닫기", "Close");
}

function validateImage(file) {
  if (!allowed.has(file.type) || !file.size || file.size > 10485760) {
    throw Error(t("JPG, PNG, WebP, AVIF 또는 GIF · 10 MB 이하", "JPG, PNG, WebP, AVIF or GIF · 10 MB maximum"));
  }
}

function stageImage(file) {
  const url = URL.createObjectURL(file);
  uploads.set(url, { file, path: owner + "/" + crypto.randomUUID() + "." + allowed.get(file.type) });
  return url;
}

function chooseImages(label, receive, { multiple = false, drop } = {}) {
  const picker = el("input");
  picker.type = "file";
  picker.accept = [...allowed.keys()].join(",");
  picker.multiple = multiple;
  const control = button(label, () => picker.click(), "quiet-button");
  function accept(files) {
    const list = [...files].slice(0, multiple ? files.length : 1);
    if (!list.length) return;
    try {
      list.forEach(validateImage);
      receive(list.map(stageImage));
    } catch (error) {
      const status = drop?.querySelector(".local-status");
      if (status) status.textContent = error.message;
      else { message = error.message; render(); }
    }
  }
  picker.addEventListener("change", () => { accept(picker.files); picker.value = ""; });
  if (drop) {
    drop.addEventListener("dragover", event => event.preventDefault());
    drop.addEventListener("drop", event => {
      event.preventDefault();
      accept(event.dataTransfer.files);
    });
  }
  return control;
}

function imageActions(src, set, drop, remove = () => set("")) {
  const row = el("div", "", "image-actions");
  row.append(chooseImages(src ? t("교체", "Replace") : t("사진 올리기", "Upload photo"),
    ([url]) => set(url), { drop }));
  if (src) row.append(button(t("삭제", "Delete"), remove, "quiet-button"));
  return row;
}

function renderHome(data) {
  page.append(el("h1", "JIHO"));
  const gallery = el("section", "", "gallery");
  const wall = el("div", "", "wall");
  const frames = el("div", "", "frames");
  const shelf = el("aside", "", "prints");
  const images = data.home.frames || [];
  for (let index = 0; index < 4; index++) {
    const src = images[index];
    const slot = el("div", "", "frame-slot");
    const title = t("전시 사진 ", "Display photo ") + (index + 1);
    const frame = button("", () => openPhoto(src, () => title), "frame");
    frame.setAttribute("aria-label", title);
    frame.disabled = !src;
    if (src) frame.append(image(src, title));
    slot.append(frame);
    if (draft) slot.append(imageActions(src, url => {
      data.home.frames ||= ["", "", "", ""];
      data.home.frames[index] = url;
      render();
    }, slot));
    frames.append(slot);
  }

  (data.home.prints || []).forEach(photo => {
    if (!photo.image && !draft) return;
    const slot = el("div", "", "print-slot");
    const title = () => localized(photo, "title") || t("사진", "Print");
    if (photo.image) {
      const tile = button("", () => openPhoto(photo.image, title), "print");
      tile.setAttribute("aria-label", title());
      tile.append(image(photo.image));
      slot.append(tile);
    }
    if (draft) slot.append(imageActions(photo.image, src => { photo.image = src; render(); }, slot));
    shelf.append(slot);
  });
  if (shelf.childElementCount) shelf.append(el("p", t("사진 보기", "VIEW PRINTS")));
  wall.append(frames);
  gallery.append(wall);
  if (shelf.childElementCount) gallery.append(shelf);
  page.append(gallery);
}

function heading(title, action) {
  const row = el("div", "", "page-heading");
  row.append(el("h1", title));
  if (action) row.append(action);
  page.append(row);
}

function renderWork(data) {
  heading(t("전체 작품", "Work"), draft && button(t("+ 작품 추가", "+ Add series"), () => seriesForm(), "primary-button"));
  const grid = el("div", "", "work-grid series-grid");
  data.projects.forEach(project => {
    const tile = link("", linkTo(project));
    tile.className = "series-card";
    if (project.cover) tile.append(image(project.cover));
    else tile.append(el("div", "", "series-blank"));
    const meta = el("div", "", "series-meta");
    meta.append(el("strong", localized(project, "title")), el("span", project.year));
    tile.append(meta);
    grid.append(tile);
  });
  page.append(grid);
}

function seriesForm(project) {
  const dialog = el("dialog", "", "series-dialog");
  const form = el("form", "", "editor");
  const next = { author: project?.author || "", title: project ? localized(project, "title") : "", year: project?.year || "" };
  form.append(el("h2", project ? t("작품 정보", "Series information") : t("작품 추가", "Add series")));
  const author = textField(next, "author", t("이름", "Name"));
  const title = textField(next, "title", t("작품명", "Series title"));
  title.querySelector("input").required = true;
  const year = textField(next, "year", t("연도", "Year"));
  year.querySelector("input").inputMode = "numeric";
  form.append(author, title, year);
  const selected = el("p", "", "local-status");
  let pictures = [];
  if (!project) form.append(chooseImages(t("사진 선택", "Choose photos"), urls => {
    pictures = urls;
    selected.textContent = t("선택한 사진 ", "Selected photos: ") + urls.length;
  }, { multiple: true, drop: form }), selected);
  const actions = el("div", "", "controls");
  const submit = el("button", t("확인", "Confirm"), "primary-button");
  submit.type = "submit";
  actions.append(submit, button(t("취소", "Cancel"), () => dialog.close()));
  form.append(actions);
  dialog.append(form);
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  form.addEventListener("submit", event => {
    event.preventDefault();
    const title = next.title.trim();
    if (!title) return;
    const item = project || { id: crypto.randomUUID(), cover: pictures[0] || "", photos: pictures.slice(1) };
    item.author = next.author.trim();
    item.year = next.year.trim();
    item.title = title;
    dialog.close();
    if (project) render();
    else {
      draft.projects.push(item);
      location.hash = linkTo(item);
    }
  });
  document.body.append(dialog);
  dialog.showModal();
}

function renderProject(project) {
  page.append(link(t("← 전체 작품", "← All work"), "#/work"));
  if (!project) {
    heading(t("작품 없음", "Project unavailable"));
    return;
  }
  const actions = el("div", "", "controls");
  if (draft) actions.append(
    button(t("정보 편집", "Edit series"), () => seriesForm(project), "quiet-button"),
    chooseImages(t("+ 사진 추가", "+ Add photos"), urls => {
      if (!project.cover) project.cover = urls.shift();
      project.photos.push(...urls);
      render();
    }, { multiple: true }),
    button(t("시리즈 삭제", "Delete series"), () => {
      if (!confirm(t("이 시리즈를 삭제할까요?", "Delete this series?"))) return;
      draft.projects = draft.projects.filter(item => item.id !== project.id);
      draft.home.featured = (draft.home.featured || []).map(id => id === project.id ? "" : id);
      location.hash = "#/work";
    }, "quiet-button")
  );
  heading(localized(project, "title"), actions);
  const meta = [project.author, project.year].filter(Boolean).join(" · ");
  if (meta) page.append(el("p", meta, "intro"));
  const description = localized(project, "text");
  if (description) page.append(el("p", description, "intro"));
  const grid = el("div", "", "photo-grid flip-grid");
  if (project.cover) grid.append(flipCard(project, "cover", project.cover));
  project.photos.forEach((src, index) => { if (src) grid.append(flipCard(project, index, src)); });
  page.append(grid);
}

function flipCard(project, key, src) {
  const card = el("article", "", "flip-card");
  const inner = el("div", "", "flip-inner");
  const front = button("", () => flip(true), "flip-face flip-front");
  front.setAttribute("aria-label", t("사진 뒷면 보기", "View photo information"));
  const photo = image(src, localized(project, "title"));
  function sizePostcard() {
    if (!photo.naturalWidth || !photo.naturalHeight) return;
    card.style.setProperty("--postcard-ratio", String(photo.naturalWidth / photo.naturalHeight));
  }
  photo.addEventListener("load", sizePostcard);
  front.append(photo);
  sizePostcard();
  const back = el("div", "", "flip-face flip-back");
  const backSurface = button("", () => flip(false), "flip-back-surface");
  backSurface.setAttribute("aria-label", t("사진 앞면 보기", "View photo front"));
  const colorIndex = key === "cover" ? 0 : Number(key) + 1;
  card.dataset.color = String(colorIndex % 4);
  const getNote = () => key === "cover" ? project.coverNote : project.photoNotes?.[key];
  back.append(backSurface);
  if (draft) {
    const form = el("form", "", "editor card-form");
    const note = { value: getNote() || "" };
    const save = el("button", t("확인", "Confirm"), "primary-button");
    save.type = "submit";
    form.append(textField(note, "value", t("사진 정보", "Photo information"), true), save);
    form.addEventListener("click", event => {
      if (event.target === form) flip(false);
    });
    form.addEventListener("submit", event => {
      event.preventDefault();
      if (key === "cover") project.coverNote = note.value;
      else {
        project.photoNotes ||= {};
        project.photoNotes[key] = note.value;
      }
      flipped.add(project.id + ":" + key);
      publish();
    });
    back.append(form);
  } else {
    backSurface.append(el("span", localized(project, "title"), "back-title"));
    if (getNote()) backSurface.append(el("span", getNote(), "back-note"));
  }
  const id = project.id + ":" + key;
  function flip(isBack, focus = true) {
    if (isBack) flipped.add(id);
    else flipped.delete(id);
    inner.classList.toggle("flipped", isBack);
    front.inert = isBack;
    back.inert = !isBack;
    if (focus) (isBack ? backSurface : front).focus();
  }
  inner.append(front, back);
  card.append(inner);
  if (draft) card.append(imageActions(src, url => {
    if (key === "cover") project.cover = url;
    else project.photos[key] = url;
    render();
  }, card, () => {
    if (key === "cover") {
      project.cover = project.photos.shift() || "";
      project.coverNote = project.photoNotes?.[0] || "";
      shiftPhotoNotes(project, 0);
    } else {
      project.photos.splice(key, 1);
      shiftPhotoNotes(project, key);
    }
    flipped.clear();
    render();
  }));
  flip(flipped.has(id), false);
  return card;
}

function shiftPhotoNotes(project, removed) {
  project.photoNotes = Object.fromEntries(Object.entries(project.photoNotes || {})
    .filter(([index]) => Number(index) !== removed)
    .map(([index, note]) => [Number(index) > removed ? Number(index) - 1 : Number(index), note]));
}

function renderAbout(about) {
  heading(t("소개", "About"));
  const layout = el("section", "", "contact-layout");
  const profile = el("div", "", "contact-profile");
  if (about.image) {
    const portrait = button("", () => openPhoto(about.image, () => "JIHO"), "portrait-button");
    portrait.setAttribute("aria-label", t("사진 확대", "Enlarge image"));
    portrait.append(image(about.image, "JIHO"));
    profile.append(portrait);
  }
  profile.append(el("h2", "JIHO"));
  const bio = localized(about, "text");
  if (bio) profile.append(el("p", bio, "intro"));
  const contacts = el("div", "", "contact-links");
  const email = about.email || "qkrwlgh0617@gmail.com";
  const handle = (about.instagram || "jiho1787").replace(/^@/, "");
  for (const [label, value, href] of [
    ["Email", email, "mailto:" + encodeURIComponent(email).replace("%40", "@")],
    ["Instagram", "@" + handle, "https://www.instagram.com/" + encodeURIComponent(handle) + "/"]
  ]) {
    const row = link("", href);
    row.append(el("span", label), el("strong", value), el("span", "↗"));
    contacts.append(row);
  }
  layout.append(profile, contacts);
  page.append(layout);
  if (!draft) return;
  const edit = panel(t("소개 편집", "Edit about"));
  edit.append(photoField(about, "image"), textField(about, "text", t("소개", "Biography"), true),
    textField(about, "email", "Email"), textField(about, "instagram", "Instagram"));
}

function panel(title) {
  const edit = el("section", "", "editor editor-panel");
  edit.append(el("h2", title));
  page.append(edit);
  return edit;
}

function fieldset(title) {
  const group = el("fieldset");
  group.append(el("legend", title));
  return group;
}

function textField(target, key, label, multiline = false) {
  const wrapper = el("label", label);
  const input = el(multiline ? "textarea" : "input");
  input.value = target[key] || "";
  input.addEventListener("input", () => { target[key] = input.value; });
  wrapper.append(input);
  return wrapper;
}

const allowed = new Map([
  ["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"],
  ["image/avif", "avif"], ["image/gif", "gif"]
]);

function photoField(target, key, remove, assign, customLabel) {
  const zone = el("div", "", "drop");
  const status = el("p");
  status.setAttribute("role", "status");
  const caption = customLabel || (target[key]
    ? t("사진 교체 또는 여기로 드래그", "Replace image or drop it here")
    : t("사진 선택 또는 여기로 드래그", "Choose an image or drop it here"));
  const label = el("label", caption);
  const input = el("input");
  input.type = "file";
  input.accept = [...allowed.keys()].join(",");
  label.append(input);
  if (target[key]) {
    zone.append(image(target[key]), button(t("사진 삭제", "Remove image"), remove || (() => {
      target[key] = "";
      render();
    })));
  }
  zone.append(label, status);

  function select(file) {
    if (!file) return;
    if (!allowed.has(file.type) || !file.size || file.size > 10485760) {
      status.textContent = t("JPG, PNG, WebP, AVIF 또는 GIF · 10 MB 이하", "JPG, PNG, WebP, AVIF or GIF · 10 MB maximum");
      input.value = "";
      return;
    }
    const temporary = URL.createObjectURL(file);
    uploads.set(temporary, { file, path: owner + "/" + crypto.randomUUID() + "." + allowed.get(file.type) });
    if (assign) assign(temporary);
    else {
      target[key] = temporary;
      render();
    }
  }

  input.addEventListener("change", () => select(input.files[0]));
  zone.addEventListener("dragover", event => {
    event.preventDefault();
    zone.classList.add("over");
  });
  zone.addEventListener("dragleave", event => {
    if (!(event.relatedTarget instanceof Node) || !zone.contains(event.relatedTarget)) zone.classList.remove("over");
  });
  zone.addEventListener("drop", event => {
    event.preventDefault();
    zone.classList.remove("over");
    select(event.dataTransfer.files[0]);
  });
  return zone;
}

function tidyDraft() {
  draft = null;
  for (const source of uploads.keys()) URL.revokeObjectURL(source);
  uploads.clear();
}

function discard() {
  if (!confirm(t("저장하지 않은 변경을 취소할까요?", "Discard unpublished changes?"))) return;
  tidyDraft();
  render();
}

async function loadPublished() {
  const { data, error } = await client.from("portfolio_site").select("revision,content").eq("id", 1).single();
  if (error) throw error;
  revision = data.revision;
  published = data.content || publishedDemo;
}

async function publish() {
  if (!draft || !owner || saving) return;
  saving = true;
  message = t("공개 중…", "Publishing…");
  render();
  try {
    const next = structuredClone(draft);
    const photos = [
      [next.about, "image"],
      ...(next.home.frames || []).map((_, index) => [next.home.frames, index]),
      ...next.home.prints.map(print => [print, "image"]),
      ...next.projects.flatMap(project => [
        [project, "cover"], ...project.photos.map((_, index) => [project.photos, index])
      ])
    ];
    const bucket = client.storage.from("portfolio");
    for (const [target, key] of photos) {
      const upload = uploads.get(target[key]);
      if (!upload) continue;
      if (!upload.sent) {
        const { error } = await bucket.upload(upload.path, upload.file, { contentType: upload.file.type });
        if (error) throw error;
        upload.sent = true;
      }
      target[key] = bucket.getPublicUrl(upload.path).data.publicUrl;
    }
    const { data, error } = await client.from("portfolio_site")
      .update({ revision: revision + 1, content: next })
      .eq("id", 1).eq("revision", revision).select("revision").maybeSingle();
    if (error) throw error;
    if (!data) throw Error(t("다른 창에서 이미 공개했습니다. 초안을 확인한 뒤 새로고침해 주세요.", "Another window published first. Review your draft before reloading."));
    published = next;
    revision = data.revision;
    tidyDraft();
    message = t("공개했습니다.", "Published.");
  } catch (error) {
    message = t("공개 실패 · ", "Could not publish · ") + error.message;
  } finally {
    saving = false;
    render();
  }
}

async function checkOwner(session) {
  owner = null;
  if (!session) return;
  const { data, error } = await client.from("portfolio_admins")
    .select("user_id").eq("user_id", session.user.id).maybeSingle();
  if (error) throw error;
  owner = data?.user_id || null;
}

function openLogin() {
  $("#login-status").textContent = client ? "" : t("연결을 불러오지 못했습니다.", "Connection unavailable.");
  login.showModal();
}

$("#login-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!client) return;
  const fields = new FormData(event.currentTarget);
  const status = $("#login-status");
  $("#sign-in").disabled = true;
  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: fields.get("email"), password: fields.get("password")
    });
    if (error) throw error;
    await checkOwner(data.session);
    if (!owner) {
      await client.auth.signOut();
      throw Error(t("관리자 계정이 아닙니다.", "This account has no owner access."));
    }
    await loadPublished();
    $("#login-form").reset();
    login.close();
    message = "";
    draft = structuredClone(published);
    render();
  } catch (error) {
    owner = null;
    status.textContent = error.message;
  } finally {
    $("#sign-in").disabled = false;
  }
});

async function signOut() {
  if (draft && !confirm(t("편집 내용을 취소하고 로그아웃할까요?", "Discard edits and sign out?"))) return;
  const { error } = await client.auth.signOut();
  if (error) {
    message = error.message;
  } else {
    tidyDraft();
    owner = null;
    message = "";
  }
  render();
}

function drawZoom() {
  const limits = [viewport.clientWidth, viewport.clientHeight].map(size => size * (scale - 1) / 2);
  position = position.map((value, index) => Math.max(-limits[index], Math.min(limits[index], value)));
  preview.style.transform = "translate(" + position[0] + "px," + position[1] + "px) scale(" + scale + ")";
  viewport.classList.toggle("zoomed", scale > 1);
  $("#zoom").textContent = scale > 1 ? t("원래 크기", "Reset zoom") : t("확대", "Zoom in");
  $("#zoom").setAttribute("aria-pressed", String(scale > 1));
}

function zoom(value, x, y) {
  const next = Math.max(1, Math.min(5, value));
  if (next === 1 || !Number.isFinite(x) || !Number.isFinite(y)) {
    position = [0, 0];
  } else {
    const rect = viewport.getBoundingClientRect();
    const anchor = [x - rect.left - rect.width / 2, y - rect.top - rect.height / 2];
    position = position.map((point, index) => anchor[index] - (anchor[index] - point) * next / scale);
  }
  scale = next;
  drag = null;
  drawZoom();
}

function openPhoto(src, title) {
  const name = title();
  $("#viewer-title").textContent = name;
  preview.alt = name;
  preview.src = src;
  viewer.showModal();
  zoom(1);
}

viewport.addEventListener("wheel", event => {
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1;
  if (event.ctrlKey) {
    event.preventDefault();
    if (gestureScale === null) zoom(scale * Math.exp(-event.deltaY * unit * 0.01), event.clientX, event.clientY);
  } else if (scale > 1) {
    event.preventDefault();
    position[0] -= event.deltaX * unit;
    position[1] -= event.deltaY * unit;
    drawZoom();
  }
}, { passive: false });

viewport.addEventListener("gesturestart", event => {
  event.preventDefault();
  gestureScale = scale;
}, { passive: false });
viewport.addEventListener("gesturechange", event => {
  event.preventDefault();
  if (gestureScale !== null && Number.isFinite(event.scale)) zoom(gestureScale * event.scale, event.clientX, event.clientY);
}, { passive: false });
viewport.addEventListener("gestureend", event => {
  event.preventDefault();
  gestureScale = null;
}, { passive: false });

viewport.addEventListener("pointerdown", event => {
  if (scale <= 1 || !event.isPrimary || event.button !== 0) return;
  drag = { id: event.pointerId, x: event.clientX - position[0], y: event.clientY - position[1] };
  viewport.setPointerCapture(event.pointerId);
});
viewport.addEventListener("pointermove", event => {
  if (drag?.id !== event.pointerId) return;
  position = [event.clientX - drag.x, event.clientY - drag.y];
  drawZoom();
});
for (const eventName of ["pointerup", "pointercancel", "lostpointercapture"]) {
  viewport.addEventListener(eventName, event => { if (drag?.id === event.pointerId) drag = null; });
}
viewer.addEventListener("close", () => { gestureScale = null; drag = null; });
$("#zoom").addEventListener("click", () => zoom(scale > 1 ? 1 : 2));
$("#close-viewer").addEventListener("click", () => viewer.close());
$("#close-login").addEventListener("click", () => login.close());
window.addEventListener("hashchange", () => {
  flipped.clear();
  render();
  window.scrollTo(0, 0);
});
render();

async function connect() {
  if (!config?.url || !config?.key) return;
  try {
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.86.0/+esm");
    client = createClient(config.url, config.key);
    await loadPublished();
    const { data } = await client.auth.getSession();
    await checkOwner(data.session);
  } catch (error) {
    console.warn("Portfolio connection:", error.message);
  }
  render();
}

connect();
