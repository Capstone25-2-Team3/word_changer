// 팝업이 열릴 때 저장된 설정 불러오기
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['blurEnabled', 'softEnabled', 'reportModeEnabled'], (result) => {
    document.getElementById('blur-toggle').checked = result.blurEnabled || false;
    document.getElementById('soft-toggle').checked = result.softEnabled || false;

    // 기능 추가 : 신고 모드 상태 복원
    const reportModeToggle = document.getElementById('report-mode-toggle');
    if (reportModeToggle) {
      reportModeToggle.checked = result.reportModeEnabled || false;
    }
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


// 기능 추가 : 신고 모드 / 선택된 댓글 신고 로직
document.addEventListener('DOMContentLoaded', () => {
  const reportModeToggle = document.getElementById('report-mode-toggle');
  const reportBtn = document.getElementById('report-btn');
  const reportClearBtn = document.getElementById('report-clear-btn');
  const reportStatus = document.getElementById('report-status');
  const reportPreview = document.getElementById('report-preview');

  if (!reportModeToggle || !reportBtn || !reportClearBtn || !reportPreview) return;

  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('활성 탭을 찾을 수 없습니다.');
    return tab;
  }

  function renderSelectedReports(selectedReports = []) {
    if (!selectedReports.length) {
      reportPreview.textContent = '선택된 댓글이 없습니다.';
      return;
    }

    const previewLines = selectedReports.slice(0, 3).map((item, idx) => {
      return `${idx + 1}. ${item.transformed_text}`;
    });

    const extra = selectedReports.length > 3
      ? `\n외 ${selectedReports.length - 3}개`
      : '';

    reportPreview.textContent =
      `선택된 댓글 ${selectedReports.length}개\n\n${previewLines.join('\n\n')}${extra}`;
  }

  async function refreshSelectedReports() {
    try {
      const tab = await getActiveTab();
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'GET_SELECTED_REPORTS'
      });
      renderSelectedReports(response?.selectedReports || []);
    } catch (error) {
      renderSelectedReports([]);
    }
  }

  // 기능 추가 : popup 열릴 때 현재 선택 상태 갱신
  refreshSelectedReports();

  // 기능 추가 : 신고 모드 toggle 저장 + content에 전달
  reportModeToggle.addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    chrome.storage.local.set({ reportModeEnabled: enabled });

    try {
      const tab = await getActiveTab();
      await chrome.tabs.sendMessage(tab.id, {
        action: 'SET_REPORT_MODE',
        enabled
      });

      reportStatus.textContent = enabled
        ? '신고 모드가 켜졌습니다. 페이지에서 체크박스를 선택하세요.'
        : '신고 모드가 꺼졌습니다.';

      refreshSelectedReports();
    } catch (error) {
      reportStatus.textContent = '실패: ' + error.message;
    }
  });

  // 기능 추가 : 선택 해제
  reportClearBtn.addEventListener('click', async () => {
    try {
      const tab = await getActiveTab();
      await chrome.tabs.sendMessage(tab.id, {
        action: 'CLEAR_SELECTED_REPORTS'
      });

      reportStatus.textContent = '선택이 해제되었습니다.';
      renderSelectedReports([]);
    } catch (error) {
      reportStatus.textContent = '실패: ' + error.message;
    }
  });

  // 기능 추가 : 선택된 댓글만 신고
  reportBtn.addEventListener('click', async () => {
    reportBtn.disabled = true;
    reportClearBtn.disabled = true;
    reportStatus.textContent = '전송 중...';

    try {
      const tab = await getActiveTab();

      const selectedResponse = await chrome.tabs.sendMessage(tab.id, {
        action: 'GET_SELECTED_REPORTS'
      });

      const selectedReports = selectedResponse?.selectedReports || [];

      if (!selectedReports.length) {
        throw new Error('선택된 댓글이 없습니다.');
      }

      const payload = {
        comments: selectedReports,
        extension_version: "1.0",
        report_type: "fine_tuning_collection"
      };

      const response = await chrome.runtime.sendMessage({
        action: 'REPORT_REQUEST',
        url: 'http://localhost:8000/report',
        data: payload
      });

      if (response?.success) {
        reportStatus.textContent = `신고가 성공적으로 전송되었습니다. (${selectedReports.length}개)`;
      } else {
        throw new Error(response?.error || '전송 실패');
      }
    } catch (error) {
      reportStatus.textContent = '실패: ' + error.message;
    } finally {
      reportBtn.disabled = false;
      reportClearBtn.disabled = false;
      refreshSelectedReports();
    }
  });
});