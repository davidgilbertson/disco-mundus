const noIdeaButton = document.getElementById('no-idea-button');
const nextButton = document.getElementById('next-button');
const questionWrapper = document.getElementById('question-wrapper');
const suburbName = document.getElementById('question-name');
const statsEl = document.getElementById('stats');

let isTouch = false;

export const setQuestionNameInnerHTML = textContent => {
  suburbName.innerHTML = textContent;
};

export const showQuestionWrapper = () => {
  questionWrapper.hidden = false;
};

export const showNoIdeaButton = () => {
  noIdeaButton.hidden = false;
  if (!isTouch) noIdeaButton.focus();
};

export const hideNoIdeaButton = () => {
  noIdeaButton.hidden = true;
};

export const showNextButton = () => {
  nextButton.hidden = false;
  if (!isTouch) nextButton.focus();
};

export const hideNextButton = () => {
  nextButton.hidden = true;
};

export const onClickNextButton = func => {
  nextButton.addEventListener('click', func);
};

export const setStatsText = ({ today, unseen, future }) => {
  statsEl.innerHTML = [
    `Review now: ${today}`,
    '<span class="stats-spacer">|</span>',
    `Review later: ${future}`,
    '<span class="stats-spacer">|</span>',
    `Unseen: ${unseen}`,
  ].join('');
};

export const onClickNoIdeaButton = func => {
  noIdeaButton.addEventListener('click', func);
};

// Somewhat dodgy logic to prevent the 'focus' ring on the buttons.
// This is a proxy for 'is a keyboard available',
// since these users are less unlikely to
// want the enter/space shortcut of going to the next question.
window.addEventListener('touchstart', function handleTouch() {
  isTouch = true;
  window.removeEventListener('touchstart', handleTouch);
});
