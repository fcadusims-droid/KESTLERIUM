// Ajudantes de interface: criar elementos, avisos (toasts), caixas de
// confirmação e de texto, ícones de ajuda. Tudo em português e simples.

import { escapeHtml } from './format.js';

// Cria um elemento com atributos e filhos de forma rápida.
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, '');
    else if (v !== false && v != null) node.setAttribute(k, v);
  }
  const list = Array.isArray(children) ? children : [children];
  for (const c of list) {
    if (c == null) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

// Mostra um aviso temporário no canto da tela.
let toastTimer = null;
export function toast(message, tipo = 'info', duracao = 3500) {
  let box = document.getElementById('toast');
  if (!box) {
    box = el('div', { id: 'toast', class: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(box);
  }
  box.textContent = message;
  box.className = `toast toast-${tipo} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { box.className = 'toast'; }, duracao);
}

// Caixa de confirmação (Sim/Não). Retorna uma Promise<boolean>.
export function confirmDialog(mensagem, { okText = 'Confirmar', cancelText = 'Cancelar', perigo = false } = {}) {
  return new Promise((resolve) => {
    const fechar = (valor) => { overlay.remove(); resolve(valor); };
    const overlay = el('div', { class: 'modal-overlay', onclick: (e) => { if (e.target === overlay) fechar(false); } }, [
      el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' }, [
        el('p', { class: 'modal-msg', html: escapeHtml(mensagem).replace(/\n/g, '<br>') }),
        el('div', { class: 'modal-acoes' }, [
          el('button', { class: 'btn btn-secundario', onclick: () => fechar(false) }, cancelText),
          el('button', { class: perigo ? 'btn btn-perigo' : 'btn btn-primario', onclick: () => fechar(true) }, okText),
        ]),
      ]),
    ]);
    document.body.appendChild(overlay);
  });
}

// Caixa para digitar um texto. Retorna Promise<string|null>.
export function promptDialog(mensagem, valorInicial = '', { okText = 'Salvar' } = {}) {
  return new Promise((resolve) => {
    const input = el('input', { class: 'campo', type: 'text', value: valorInicial });
    const fechar = (valor) => { overlay.remove(); resolve(valor); };
    const overlay = el('div', { class: 'modal-overlay', onclick: (e) => { if (e.target === overlay) fechar(null); } }, [
      el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' }, [
        el('p', { class: 'modal-msg', text: mensagem }),
        input,
        el('div', { class: 'modal-acoes' }, [
          el('button', { class: 'btn btn-secundario', onclick: () => fechar(null) }, 'Cancelar'),
          el('button', { class: 'btn btn-primario', onclick: () => fechar(input.value.trim()) }, okText),
        ]),
      ]),
    ]);
    document.body.appendChild(overlay);
    setTimeout(() => { input.focus(); input.select(); }, 50);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') fechar(input.value.trim()); });
  });
}

// Pequeno ícone de ajuda com texto explicativo ao passar o mouse.
export function ajuda(texto) {
  return el('span', { class: 'ajuda', title: texto, 'aria-label': texto, tabindex: '0' }, '?');
}

// Bloco de texto de ajuda (dica) que aparece sob um título.
export function dica(texto) {
  return el('p', { class: 'dica' }, texto);
}
