// 팝업이 열릴 때 저장된 설정 불러오기
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['blurEnabled', 'softEnabled'], (result) => {
    document.getElementById('blur-toggle').checked = result.blurEnabled || false;
    document.getElementById('soft-toggle').checked = result.softEnabled || false;
  });
});

// Blur 스위치 변경 시 저장
document.getElementById('blur-toggle').addEventListener('change', (e) => {
  const isEnabled = e.target.checked;
  chrome.storage.local.set({ blurEnabled: isEnabled }, () => {
    console.log('Blur 설정 저장됨:', isEnabled);
  });
});

// 순화 스위치 변경 시 저장
document.getElementById('soft-toggle').addEventListener('change', (e) => {
  const isEnabled = e.target.checked;
  chrome.storage.local.set({ softEnabled: isEnabled }, () => {
    console.log('순화 설정 저장됨:', isEnabled);
  });
});