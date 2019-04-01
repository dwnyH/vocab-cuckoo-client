/* global chrome */
let questionNotif;
let answerNotif;
let answerNotifOptions;

const contextMenuItem = {
  id: 'vocab-cuckoo',
  title: 'Vocab Cuckoo',
  contexts: ['selection'],
};

const isEnglish = text => (
  (text.charCodeAt() >= 65 && text.charCodeAt() <= 90)
    || (text.charCodeAt() >= 97 && text.charCodeAt() <= 122)
    || (text.charCodeAt() === 32 || text.charCodeAt() === 44 || text.charCodeAt() === 46)
);

const isKorean = text => (
  (text.charCodeAt() >= 44031 && text.charCodeAt() <= 55203)
    || (text.charCodeAt() === 32 || text.charCodeAt() === 44 || text.charCodeAt() === 46)
);

const dataDuplicationCheck = (storagedTextsInfo, newText) => (
  storagedTextsInfo.every(textInfo => textInfo.text !== newText)
);

const requestTranslatedData = async (text, translateTo) => {
  try {
    const url = 'https://www.googleapis.com/language/translate/v2';
    const apiKey = 'AIzaSyCSIxq56RM04tlJnHEMLT8vB-U2gyia-yE';
    const response = await fetch(`${url}/?key=${apiKey}&q=${text}&target=${translateTo}`);
    const responseData = await response.json();

    return responseData.data.translations[0].translatedText;
  } catch (err) {
    return window.alert('현재 시스템에 오류가 있어 저장이 되지 않습니다.');
  }
};

const updateDB = async (selectedWord) => {
  const token = localStorage.getItem('userToken');
  const id = localStorage.getItem('userId');

  if (token && id) {
    const { text, date, translated } = selectedWord;
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];

    const savedMonth = `${monthNames[new Date(date).getMonth()]}, ${new Date(date).getFullYear()}`;
    const resultResponse = await fetch(`http://VocabCuckoo-env.mzsbp3pzzy.ap-northeast-2.elasticbeanstalk.com/users/${id}/words`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'x-auth': token,
      },
      body: JSON.stringify({
        savedAt: date,
        savedMonth,
        word: text,
        translated,
      }),
    });
    if (resultResponse.status !== 200) {
      window.alert('시스템에 오류가 있어 wordbook에 저장할 수 없습니다.');
    }
  }
};

const updateStorage = (wordStorage, selectedInfo) => {
  if (wordStorage.length < 10) {
    wordStorage.unshift(selectedInfo);
  } else {
    wordStorage.pop();
    wordStorage.unshift(selectedInfo);
  }

  chrome.storage.sync.set({
    words: wordStorage,
  }, () => {
    window.alert(`단어 ${selectedInfo.text} 가 저장되었습니다 :)`);
    updateDB(selectedInfo);

    if (chrome.runtime.lastError) {
      console.log(chrome.runtime.lastError);
    }
  });
};

chrome.contextMenus.onClicked.addListener(async (clickedData) => {
  const { menuItemId, selectionText } = clickedData;
  if (menuItemId === 'vocab-cuckoo' && selectionText && typeof selectionText === 'string') {
    let language;
    let translated;
    const date = new Date().toISOString();
    debugger;
    if (selectionText.split('').every(isEnglish)) {
      language = 'en';
      translated = await requestTranslatedData(selectionText, 'ko');
    } else if (selectionText.split('').every(isKorean)) {
      debugger;
      language = 'ko';
      translated = await requestTranslatedData(selectionText, 'en');
    }

    if (language) {
      if (!translated) {
        window.alert('번역된 단어가 없습니다.');
      }
      chrome.storage.sync.get('words', (data) => {
        const selectedInfo = {
          text: selectionText.toLowerCase(),
          language,
          date,
          translated,
        };

        if (Object.keys(data).length) {
          if (dataDuplicationCheck(data.words, selectedInfo.text)) {
            updateStorage(data.words, selectedInfo);
          } else {
            window.alert('이미 저장된 단어입니다!');
          }
        } else {
          updateStorage([], selectedInfo);
        }

        if (chrome.runtime.lastError) {
          console.log(chrome.runtime.lastError);
        }
      });
    } else {
      window.alert('영어 또는 한국어로 구성된 단어를 저장해주세요 :)');
    }
  }
});

const setAlarm = (updatedAlarmInfo) => {
  const dt = new Date();
  let alarmInfo;

  chrome.alarms.clearAll(() => {
    if (updatedAlarmInfo && updatedAlarmInfo !== 'delay' && updatedAlarmInfo !== 'forward') {
      const { hours, minutes, frequency } = updatedAlarmInfo;

      updatedAlarmInfo.todayAlarm = 'on';
      chrome.storage.sync.set({
        alarmInfo: updatedAlarmInfo,
      }, () => {
        dt.setHours(hours);
        dt.setMinutes(minutes);

        alarmInfo = {
          when: dt.valueOf(),
          periodInMinutes: frequency || null,
        };

        chrome.alarms.create('cuckooAlarm', alarmInfo);

        if (chrome.runtime.lastError) {
          console.log(chrome.runtime.lastError);
        }
      });
    } else {
      chrome.storage.sync.get('alarmInfo', (storagedAlarmData) => {
        if (storagedAlarmData.alarmInfo) {
          const { hours, minutes, frequency } = storagedAlarmData.alarmInfo;
          dt.setHours(hours);
          dt.setMinutes(minutes);

          if (updatedAlarmInfo === 'delay') {
            dt.setDate(dt.getDate() + 1);
          }

          alarmInfo = {
            when: dt.valueOf(),
            periodInMinutes: frequency || null,
          };
        } else {
          return;
        }

        chrome.alarms.create('cuckooAlarm', alarmInfo);
      });
    }

    if (chrome.runtime.lastError) {
      console.log(chrome.runtime.lastError);
    }
  });
};

const setBackgroundEnv = () => {
  chrome.notifications.getAll((notifs) => {
    if (Object.keys(notifs).length) {
      for (const key in notifs) {
        chrome.notifications.clear(key);
      }
    }
  });

  chrome.contextMenus.create(contextMenuItem);
  setAlarm();
};

const handleAlarm = () => {
  chrome.storage.sync.get('words', (data) => {
    if (Object.keys(data).length) {
      const randomNumber = Math.floor(Math.random() * Object.keys(data).length);
      const alertWord = data.words[randomNumber].text;
      const translatedWord = data.words[randomNumber].translated;
      const notifOptions = {
        type: 'basic',
        iconUrl: '/icons/vocab-cuckoo48.png',
        title: 'cuckoo!',
        message: `Do you remember word ${alertWord}?`,
        buttons: [{
          title: 'Show Definition',
        }, {
          title: 'Ignore',
        }],
        requireInteraction: true,
      };

      answerNotifOptions = {
        type: 'basic',
        iconUrl: '/icons/vocab-cuckoo48.png',
        title: alertWord,
        message: translatedWord,
        buttons: [{
          title: 'Thanks!',
        }],
        requireInteraction: true,
      };

      chrome.notifications.create(notifOptions, (id) => {
        questionNotif = id;
      });
    }

    if (chrome.runtime.lastError) {
      console.log(chrome.runtime.lastError);
    }
  });
};

chrome.runtime.onInstalled.addListener(setBackgroundEnv);

chrome.runtime.onStartup.addListener(setBackgroundEnv);

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'alarmSet') {
    setAlarm(message.alarmInfo);
  } else if (message.type === 'alarmOff') {
    setAlarm('delay');
  } else if (message.type === 'alarmOn') {
    setAlarm('forward');
  }
});

chrome.alarms.onAlarm.addListener(handleAlarm);

chrome.notifications.onButtonClicked.addListener((notifId, btnIdx) => {
  if (notifId === questionNotif) {
    if (btnIdx === 0) {
      chrome.notifications.create(answerNotifOptions, (id) => {
        answerNotif = id;
      });
    } else if (btnIdx === 1) {
      chrome.notifications.clear(notifId);
    }
  } else if (notifId === answerNotif) {
    if (btnIdx === 0) {
      chrome.notifications.clear(notifId);
    }
  }
});
