(() => {
  setLocale("en");
  choose("user", "redeem-terms");
  const h1 = document.querySelector(".main h1");
  return {
    locale: document.documentElement.lang,
    h1: h1 ? h1.innerText : "",
  };
})();
