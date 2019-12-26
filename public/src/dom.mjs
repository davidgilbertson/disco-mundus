const noIdeaButton = document.getElementById('no-idea-button');
const nextButton = document.getElementById('next-button');
const questionWrapper = document.getElementById('question-wrapper');
const suburbName = document.getElementById('question-name');
const hint = document.getElementById('hint');

export const setQuestionNameInnerHTML = textContent => {
  suburbName.innerHTML = textContent; // innerHTML FTW!
};

export const showQuestionWrapper = () => {
  questionWrapper.hidden = false;
};

export const showNoIdeaButton = () => {
  noIdeaButton.hidden = false;
  noIdeaButton.focus();
};

export const hideNoIdeaButton = () => {
  noIdeaButton.hidden = true;
};

export const showNextButton = () => {
  nextButton.hidden = false;
  nextButton.focus();
};

export const hideNextButton = () => {
  nextButton.hidden = true;
};

export const onClickNextButton = func => {
  nextButton.addEventListener('click', func);
};

export const setHintText = textContent => {
  hint.textContent = textContent;
};

export const onClickNoIdeaButton = func => {
  noIdeaButton.addEventListener('click', func);
};
