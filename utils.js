async function loadTemperatureData(json) {
  try {
    const response = await fetch('temperatures.json');
    const data = await response.json();

    // 時間を日付形式に変換してソート
    const sortedData = data.temperatures.sort((a, b) => a.time - b.time);

    // 日付ごとにデータを分ける
    const dataByDate = {};

    sortedData.forEach(item => {
      const date = new Date(item.time);
      const dateKey = date.toLocaleDateString('ja-JP');

      if (!dataByDate[dateKey]) {
        dataByDate[dateKey] = [];
      }

      dataByDate[dateKey].push({
        time: item.time,
        temp: item.temp,
        hour: date.getHours(),
        minutes: date.getMinutes()
      });
    });

    // 0時から23時までのラベルを作成
    const hourLabels = Array.from({ length: 24 }, (_, i) => `${i}時`);

    // 各日付のデータセットを作成
    const datasets = [];
    const colors = ['#4ecdc4', '#ff6b6b', '#45b7d1', '#96ceb4', '#feca57'];
    let colorIndex = 0;

    Object.keys(dataByDate).forEach(dateKey => {
      const dayData = dataByDate[dateKey];
      const hourlyTemps = Array.from({ length: 24 }, (_, targetHour) => {
        // 前の時間から現在の時間までのデータを検索
        const startTime = targetHour === 0 ? 0 : targetHour * 60; // 分に変換
        const endTime = (targetHour + 1) * 60; // 分に変換

        // 対象時間範囲内のデータを取得
        const candidates = dayData.filter(item => {
          const totalMinutes = item.hour * 60 + item.minutes;
          return totalMinutes > startTime && totalMinutes <= endTime;
        });

        if (candidates.length === 0) {
          return null; // データがない場合は null
        }

        // 目標時刻（例：2時なら2:00）に最も近い（かつ直前の）データを選択
        const targetMinutes = endTime; // 目標時刻（分）
        let closestData = null;
        let minDistance = Infinity;

        candidates.forEach(item => {
          const itemMinutes = item.hour * 60 + item.minutes;
          const distance = targetMinutes - itemMinutes;

          // 直前のデータのみを考慮（distance > 0）し、最も近いものを選択
          if (distance > 0 && distance < minDistance) {
            minDistance = distance;
            closestData = item;
          }
        });

        return closestData ? closestData.temp : null;
      });

      datasets.push({
        label: `${dateKey}の温度 (°C)`,
        data: hourlyTemps,
        backgroundColor: colors[colorIndex % colors.length] + '80', // 透明度を追加
        borderColor: colors[colorIndex % colors.length],
        borderWidth: 2
      });

      colorIndex++;
    });

    createChart(hourLabels, datasets);

    // 情報表示を更新
    const dateCount = Object.keys(dataByDate).length;
    const totalDataPoints = sortedData.length;
    document.getElementById('mytemp-info').textContent =
      `対象日数: ${dateCount}日 | 総データ点数: ${totalDataPoints}個`;

    // 時刻別温度のテーブル表示
    const tableBody = document.getElementById('mytemp-table-body');
    tableBody.innerHTML = ''; // テーブルをクリア
    [...sortedData].reverse().forEach((item, index) => {
      const date = new Date(item.time);
      const row = document.createElement('tr');

      // 1時間おき（分が00に近い）かどうかを判定
      const isHourMark = date.getMinutes() === 0 ||
        (index > 0 && Math.abs(date.getMinutes() - 0) < 5);

      if (isHourMark) {
        row.classList.add('hour-mark');
      }

      row.innerHTML = `
                <td>${date.toLocaleString('ja-JP', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })}</td>
                <td>${item.temp} °C</td>
            `;
      tableBody.appendChild(row);
    });

    // 最新のバッテリー残量を取得し、mytemp-batteryに表示
    const latestBattery = sortedData[sortedData.length - 1].bat;
    // バッテリー残量テキストの設定
    document.getElementById('mytemp-battery').textContent =
      `最新のバッテリー残量: ${latestBattery}`;

  } catch (error) {
    console.error('データの読み込みに失敗しました:', error);
    document.getElementById('mytemp-info').textContent =
      'データの読み込みに失敗しました。temperatures.jsonファイルを確認してください。';
  }
}

function createChart(labels, datasets) {
  const ctx = document.getElementById('mytemp-chart').getContext('2d');

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: datasets.map((dataset, index) => ({
        ...dataset,
        spanGaps: true,  // データがない区間でも線を繋ぐ
        tension: 0.1,    // 線を滑らかにする
        pointRadius: 3,  // ポイントのサイズ
        pointHoverRadius: 5,  // ホバー時のポイントサイズ
        fill: false,     // 塗りつぶしを無効にして線グラフに
        order: datasets.length - index - 1  // 後の日付を手前、前の日付を背面に
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: {
            display: true,
            text: '時間',
            color: '#666'
          },
          grid: {
            color: 'rgba(0,0,0,0.1)'
          }
        },
        y: {
          title: {
            display: true,
            text: '温度 (°C)',
            color: '#666'
          },
          grid: {
            color: 'rgba(0,0,0,0.1)'
          }
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: function (context) {
              if (context.parsed.y === null) {
                return `${context.dataset.label}: データなし`;
              }
              return `${context.dataset.label}: ${context.parsed.y}°C`;
            }
          }
        }
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      },
      elements: {
        line: {
          spanGaps: true  // 線要素レベルでも設定
        }
      }
    }
  });
}

