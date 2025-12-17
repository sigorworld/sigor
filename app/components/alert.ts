import { el } from '@webtaku/el';

async function showErrorAlert(title: string, message: string) {
  const alert = el(
    'sl-alert',
    {
      variant: 'danger',
      closable: true,
    },
    el('sl-icon', { slot: 'icon', name: 'exclamation-octagon' }),
    el('strong', title),
    el('br'),
    message
  );

  document.body.appendChild(alert);

  await customElements.whenDefined('sl-alert');
  alert.toast();
}

export { showErrorAlert };
