/**
 * Strips ANSI escape color codes from a string.
 */
export const stripAnsi = (str: string): string => {
  return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
};
