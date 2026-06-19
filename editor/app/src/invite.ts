export interface InviteParts { link: string; username: string; password: string; }

export function buildInvite(p: InviteParts): { text: string; mailto: string } {
  const text =
    `You can now edit your website.\n\n` +
    `Edit link: ${p.link}\n` +
    `Username: ${p.username}\n` +
    `Password: ${p.password}\n\n` +
    `Open the link, click "Sign in", and enter the username and password above.`;
  const subject = "Your website editing access";
  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  return { text, mailto };
}
