// JavaScript = the WAITER. It makes things happen when you click.
const button = document.getElementById("hello-button");
const message = document.getElementById("message");

button.addEventListener("click", () => {
  message.textContent = "The waiter heard you! JavaScript is working.";
});
