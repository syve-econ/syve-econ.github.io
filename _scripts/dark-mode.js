/*
  force light mode always.
*/

{
  document.documentElement.dataset.dark = "false";
  window.localStorage.setItem("dark-mode", "false");
  window.onDarkToggleChange = () => {};
}
