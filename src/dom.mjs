const noIdeaButton = document.getElementById('no-idea-button');
const nextButton = document.getElementById('next-button');
const questionWrapper = document.getElementById('question-wrapper');
const suburbName = document.getElementById('suburb-name');
const hint = document.getElementById('hint');

export const setQuestionName = textContent => {
  suburbName.textContent = textContent;
};

export const showQuestionWrapper = () => {
  questionWrapper.hidden = false;
};

export const showNoIdeaButton = () => {
  noIdeaButton.hidden = false;
};

export const hideNoIdeaButton = () => {
  noIdeaButton.hidden = true;
};

export const showNextButton = () => {
  nextButton.hidden = false;
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

export const onNoIdeaClick = func => {
  noIdeaButton.addEventListener('click', func);
};
