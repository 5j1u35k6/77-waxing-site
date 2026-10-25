(() => {
  'use strict';

  const WIDGET_ID = '458d5dd5-5d9f-43ba-8188-943c6d9489b8';
  const API_URL = `https://api.featurable.com/v2/widgets/${WIDGET_ID}`;
  const PROVIDER_URL = `https://featurable.com/?utm_source=widget&utm_medium=${WIDGET_ID}`;
  const GOOGLE_URL = 'https://www.google.com/maps/place//data=!4m3!3m2!1s0x345d4f7467de09a9:0x38e3577d2ad40bd2!12e1?g_mp=CiVnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLkdldFBsYWNlEAIYBCAA';
  const CACHE_MS = 5 * 60 * 1000;
  const mounts = new Map();
  let cached = null;
  let inFlight = null;
  let sequence = 0;
  let sweepPending = false;

  const text = value => typeof value === 'string' ? value.trim() : '';
  const element = (tag, className, value) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = value;
    return node;
  };
  const httpsUrl = value => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' ? url.href : '';
    } catch { return ''; }
  };
  const googleUrl = value => {
    const href = httpsUrl(value);
    if (!href) return '';
    const host = new URL(href).hostname;
    return host === 'google.com' || host.endsWith('.google.com') ? href : '';
  };
  const link = (label, href, className) => {
    const node = element('a', className, label);
    node.href = href;
    node.target = '_blank';
    node.rel = 'noopener noreferrer';
    return node;
  };

  function normalizeWidget(payload) {
    const widget = payload?.widget;
    if (payload?.success !== true || !widget || widget.isExampleReviews === true) {
      throw new Error('REVIEWS_UNAVAILABLE');
    }
    const reviews = (Array.isArray(widget.reviews) ? widget.reviews : []).flatMap(review => {
      const body = text(review?.originalText) || text(review?.text);
      const rating = Number(review?.rating?.value);
      const max = Number(review?.rating?.max);
      if (!body || !Number.isFinite(rating) || !Number.isFinite(max) || max <= 0 || rating < 0 || rating > max) return [];
      return [{
        body,
        name: text(review.author?.name) || 'Google 使用者',
        avatar: httpsUrl(review.author?.avatarUrl),
        profile: googleUrl(review.author?.profileUrl),
        rating,
        max,
        date: text(review.publishedAt),
      }];
    });
    const summary = widget.gbpLocationSummary || {};
    const average = summary.rating == null ? NaN : Number(summary.rating);
    const count = summary.reviewsCount == null ? NaN : Number(summary.reviewsCount);
    return {
      reviews,
      average: Number.isFinite(average) && average >= 0 && average <= 5 ? average : null,
      count: Number.isInteger(count) && count >= 0 ? count : null,
      googleUrl: googleUrl(summary.writeAReviewUri) || GOOGLE_URL,
    };
  }

  async function loadWidget(force = false) {
    if (!force && cached && Date.now() - cached.time < CACHE_MS) return cached.data;
    if (inFlight) return inFlight;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const request = (async () => {
      try {
        const response = await fetch(API_URL, {
          credentials: 'omit',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('REVIEWS_UNAVAILABLE');
        const data = normalizeWidget(await response.json());
        cached = { time: Date.now(), data };
        return data;
      } finally { clearTimeout(timer); }
    })();
    inFlight = request;
    try { return await request; }
    finally { if (inFlight === request) inFlight = null; }
  }

  function sourceLinks(root, googleUrl = GOOGLE_URL) {
    const footer = element('div', 'home-reviews-links');
    footer.append(
      link('前往 Google 閱讀評論', googleUrl, 'home-reviews-google-link'),
      link('由 Featurable 提供', PROVIDER_URL, 'home-reviews-provider'),
    );
    root.append(footer);
  }

  function showStatus(state, message, retry = false, googleUrl = GOOGLE_URL) {
    state.cleanupView?.();
    state.cleanupView = null;
    const box = element('div', 'home-reviews-status');
    const status = element('p', '', message);
    status.setAttribute('role', 'status');
    box.append(status);
    if (retry) {
      const button = element('button', 'home-reviews-retry', '重新載入');
      button.type = 'button';
      button.addEventListener('click', () => state.load(true));
      box.append(button);
    }
    state.root.replaceChildren(box);
    sourceLinks(state.root, googleUrl);
  }

  function reviewCard(review, id, measurements) {
    const card = element('article', 'home-review-card');
    card.setAttribute('role', 'listitem');
    const author = element('header', 'home-review-author');
    const avatar = element('span', 'home-review-avatar', Array.from(review.name)[0] || 'G');
    avatar.setAttribute('aria-hidden', 'true');
    if (review.avatar) {
      const image = element('img');
      image.src = review.avatar;
      image.alt = '';
      image.width = image.height = 44;
      image.loading = 'lazy';
      image.decoding = 'async';
      image.referrerPolicy = 'no-referrer';
      image.addEventListener('error', () => image.remove(), { once: true });
      avatar.append(image);
    }
    const identity = element('div', 'home-review-identity');
    identity.append(review.profile
      ? link(review.name, review.profile, 'home-review-name')
      : element('span', 'home-review-name', review.name));
    const date = new Date(review.date);
    if (review.date && Number.isFinite(date.getTime())) {
      const time = element('time', 'home-review-date', new Intl.DateTimeFormat('zh-TW', {
        year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Taipei',
      }).format(date));
      time.dateTime = date.toISOString();
      identity.append(time);
    }
    author.append(avatar, identity);
    const stars = element('span', 'home-review-stars', '★★★★★');
    stars.setAttribute('role', 'img');
    stars.setAttribute('aria-label', `${review.rating}／${review.max} 顆星`);
    const fill = element('span', 'home-review-stars-fill', '★★★★★');
    fill.setAttribute('aria-hidden', 'true');
    fill.style.width = `${review.rating / review.max * 100}%`;
    stars.append(fill);
    const body = element('p', 'home-review-text home-review-text-collapsed', review.body);
    body.id = id;
    const toggle = element('button', 'home-review-expand', '展開全文');
    toggle.type = 'button';
    toggle.hidden = true;
    toggle.setAttribute('aria-controls', id);
    toggle.setAttribute('aria-expanded', 'false');
    let expanded = false;
    toggle.addEventListener('click', () => {
      expanded = !expanded;
      body.classList.toggle('home-review-text-collapsed', !expanded);
      toggle.setAttribute('aria-expanded', String(expanded));
      toggle.textContent = expanded ? '收合' : '展開全文';
    });
    measurements.push(() => {
      toggle.hidden = !expanded && body.scrollHeight <= body.clientHeight + 1;
    });
    card.append(author, stars, body, toggle);
    return card;
  }

  function showReviews(state, data) {
    if (!data.reviews.length) {
      showStatus(state, '目前沒有可顯示的評論，歡迎前往 Google 閱讀。', false, data.googleUrl);
      return;
    }
    state.cleanupView?.();
    const header = element('div', 'home-reviews-header');
    const summary = element('div', 'home-reviews-summary');
    summary.append(element('p', 'home-reviews-source', 'Google 評論'));
    if (data.average !== null) summary.append(element('strong', 'home-reviews-average', `${data.average.toFixed(1)} 分`));
    if (data.count !== null) summary.append(element('span', 'home-reviews-count', `${data.count.toLocaleString('zh-TW')} 則評論`));
    const controls = element('div', 'home-reviews-controls');
    const previous = element('button', 'home-reviews-arrow', '←');
    const next = element('button', 'home-reviews-arrow', '→');
    previous.type = next.type = 'button';
    previous.setAttribute('aria-label', '上一組評論');
    next.setAttribute('aria-label', '下一組評論');
    const track = element('div', 'home-reviews-track');
    track.id = `home-reviews-track-${state.id}`;
    track.tabIndex = 0;
    track.setAttribute('role', 'list');
    track.setAttribute('aria-label', '顧客 Google 評論，可使用左右方向鍵瀏覽');
    previous.setAttribute('aria-controls', track.id);
    next.setAttribute('aria-controls', track.id);
    controls.append(previous, next);
    header.append(summary, controls);
    const measurements = [];
    data.reviews.forEach((review, index) => track.append(reviewCard(review, `home-review-${state.id}-${index}`, measurements)));
    state.root.replaceChildren(header, track);
    sourceLinks(state.root, data.googleUrl);

    let frame = 0;
    const layout = () => {
      frame = 0;
      if (state.destroyed) return;
      previous.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
      measurements.forEach(measure => measure());
    };
    const scheduleLayout = () => {
      if (!frame) frame = requestAnimationFrame(layout);
    };
    const move = direction => {
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      track.scrollBy({ left: direction * track.clientWidth, behavior: reduceMotion ? 'auto' : 'smooth' });
    };
    previous.addEventListener('click', () => move(-1));
    next.addEventListener('click', () => move(1));
    track.addEventListener('scroll', scheduleLayout, { passive: true });
    track.addEventListener('keydown', event => {
      if (event.target !== track) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        move(event.key === 'ArrowRight' ? 1 : -1);
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        track.scrollTo({ left: event.key === 'Home' ? 0 : track.scrollWidth, behavior: 'auto' });
      }
    });
    const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(scheduleLayout) : null;
    if (resize) resize.observe(state.root);
    else window.addEventListener('resize', scheduleLayout, { passive: true });
    state.cleanupView = () => {
      resize?.disconnect();
      window.removeEventListener('resize', scheduleLayout);
      track.removeEventListener('scroll', scheduleLayout);
      if (frame) cancelAnimationFrame(frame);
    };
    scheduleLayout();
  }

  function mount(host) {
    if (mounts.has(host) || host.dataset.homeReviewsMounted === '1') return;
    const state = { host, root: element('section', 'home-reviews'), id: ++sequence, destroyed: false, loading: false, intersection: null, cleanupView: null };
    mounts.set(host, state);
    host.dataset.homeReviewsMounted = '1';
    state.root.setAttribute('aria-label', 'Google 顧客評論');
    host.replaceChildren(state.root);
    showStatus(state, '正在載入 Google 評論…');
    state.load = async (force = false) => {
      if (state.destroyed || state.loading) return;
      state.loading = true;
      state.root.setAttribute('aria-busy', 'true');
      showStatus(state, '正在載入 Google 評論…');
      try {
        const data = await loadWidget(force);
        if (!state.destroyed && host.isConnected) showReviews(state, data);
      } catch {
        if (!state.destroyed && host.isConnected) showStatus(state, '目前無法載入 Google 評論，請稍後再試。', true);
      } finally {
        state.loading = false;
        state.root.removeAttribute('aria-busy');
      }
    };
    if (typeof IntersectionObserver === 'function') {
      state.intersection = new IntersectionObserver(entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        state.intersection.disconnect();
        state.load();
      }, { rootMargin: '350px 0px' });
      state.intersection.observe(host);
    } else state.load();
  }

  function sweep() {
    sweepPending = false;
    for (const [host, state] of mounts) {
      if (host.isConnected) continue;
      state.destroyed = true;
      state.intersection?.disconnect();
      state.cleanupView?.();
      delete host.dataset.homeReviewsMounted;
      mounts.delete(host);
    }
    document.querySelectorAll('[data-home-recommend-slot]').forEach(mount);
  }

  function start() {
    sweep();
    new MutationObserver(() => {
      if (sweepPending) return;
      sweepPending = true;
      requestAnimationFrame(sweep);
    }).observe(document.querySelector('#app') || document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
