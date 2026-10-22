let locks = 0;
let previous = "";

/**
 * Kunci scroll halaman saat menu atau panel terbuka. Dikunci lewat <html>, bukan <body>:
 * html dan body sama-sama memakai `overflow-x: clip`, jadi `overflow: hidden` di body tidak lagi
 * diteruskan ke viewport dan body berubah jadi scroll container. Akibatnya header `sticky`
 * lepas dari layar saat menu dibuka. Dihitung per pemanggil supaya panel bertumpuk aman.
 */
export function lockScroll(): () => void {
  if (typeof document === "undefined") return () => {};
  const root = document.documentElement;
  if (locks === 0) {
    previous = root.style.overflow;
    root.style.overflow = "hidden";
  }
  locks++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks--;
    if (locks === 0) root.style.overflow = previous;
  };
}
