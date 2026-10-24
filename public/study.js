const KEY = 'study';

export const loadStudy = () => JSON.parse(sessionStorage.getItem(KEY));
export const saveStudy = (study) => sessionStorage.setItem(KEY, JSON.stringify(study));
export const clearStudy = () => sessionStorage.removeItem(KEY);
