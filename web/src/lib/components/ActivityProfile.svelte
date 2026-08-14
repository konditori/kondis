<script lang="ts">
  type ProfilePoint = {
    distance: number;
    time: number;
    altitude: number;
    heartRate: number | null;
  };
  type Selection = { startTime: number; endTime: number; label: string } | null;

  let {
    points,
    selection = null,
    pointTime = null,
    onPointHover,
  }: {
    points: ProfilePoint[];
    selection?: Selection;
    pointTime?: number | null;
    onPointHover?: (point: ProfilePoint | null) => void;
  } = $props();

  const width = 820;
  const height = 250;
  const padding = { top: 22, right: 18, bottom: 30, left: 46 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const validPoints = $derived(
    points.filter(
      (point) =>
        Number.isFinite(point.distance) && Number.isFinite(point.altitude),
    ),
  );
  const minDistance = $derived(validPoints.at(0)?.distance ?? 0);
  const maxDistance = $derived(validPoints.at(-1)?.distance ?? 1);
  const rawMinAltitude = $derived(
    validPoints.length === 0
      ? 0
      : Math.min(...validPoints.map((point) => point.altitude)),
  );
  const rawMaxAltitude = $derived(
    validPoints.length === 0
      ? 1
      : Math.max(...validPoints.map((point) => point.altitude)),
  );
  const altitudePadding = $derived(
    Math.max((rawMaxAltitude - rawMinAltitude) * 0.12, 4),
  );
  const minAltitude = $derived(rawMinAltitude - altitudePadding);
  const maxAltitude = $derived(rawMaxAltitude + altitudePadding);
  const x = (distance: number) =>
    padding.left +
    ((distance - minDistance) / Math.max(maxDistance - minDistance, 1)) *
      chartWidth;
  const y = (altitude: number) =>
    padding.top +
    ((maxAltitude - altitude) / Math.max(maxAltitude - minAltitude, 1)) *
      chartHeight;
  const profilePath = $derived(
    validPoints
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"} ${x(point.distance)} ${y(point.altitude)}`,
      )
      .join(" "),
  );
  const areaPath = $derived(
    validPoints.length === 0
      ? ""
      : `${profilePath} L ${x(validPoints.at(-1)!.distance)} ${padding.top + chartHeight} L ${x(validPoints[0]!.distance)} ${padding.top + chartHeight} Z`,
  );
  const selectedPoints = $derived(
    selection
      ? validPoints.filter(
          (point) =>
            point.time >= selection.startTime &&
            point.time <= selection.endTime,
        )
      : [],
  );
  const selectionStart = $derived(selectedPoints.at(0));
  const selectionEnd = $derived(selectedPoints.at(-1));
  const ticks = $derived(
    [0, 0.5, 1].map((ratio) =>
      Math.round(minAltitude + (maxAltitude - minAltitude) * ratio),
    ),
  );
  const kilometerLines = $derived(
    Array.from({ length: Math.floor(maxDistance / 1000) }, (_, index) => ({
      kilometer: index + 1,
      distance: (index + 1) * 1000,
    })),
  );
  let hoveredPoint = $state<ProfilePoint | null>(null);
  let cursorX = $state<number | null>(null);
  const externalPoint = $derived(
    pointTime == null
      ? null
      : validPoints.reduce((closest, point) =>
          Math.abs(point.time - pointTime) < Math.abs(closest.time - pointTime)
            ? point
            : closest,
        ),
  );
  const displayedPoint = $derived(externalPoint ?? hoveredPoint);
  const hoveredX = $derived(
    cursorX ?? (displayedPoint ? x(displayedPoint.distance) : 0),
  );
  const hoveredY = $derived(displayedPoint ? y(displayedPoint.altitude) : 0);
  const tooltipX = $derived(
    hoveredX + 170 > width - padding.right
      ? Math.max(hoveredX - 170 - 12, padding.left + 8)
      : Math.min(hoveredX + 12, width - 170),
  );
  const tooltipY = $derived(Math.max(hoveredY - 84, padding.top + 8));
  const previousPoint = $derived(
    displayedPoint && validPoints.length > 1
      ? validPoints[Math.max(validPoints.indexOf(displayedPoint) - 1, 0)]
      : null,
  );
  const pointPace = $derived(
    displayedPoint &&
      previousPoint &&
      displayedPoint.distance > previousPoint.distance &&
      displayedPoint.time > previousPoint.time
      ? (displayedPoint.time - previousPoint.time) /
          ((displayedPoint.distance - previousPoint.distance) / 1000)
      : null,
  );
  const paceText = (seconds: number | null) => {
    if (seconds == null || !Number.isFinite(seconds)) return "—";
    return `${Math.floor(seconds / 60)}:${Math.round(seconds % 60)
      .toString()
      .padStart(2, "0")} /km`;
  };

  function handleGraphMove(event: PointerEvent) {
    const svg = event.currentTarget as SVGSVGElement;
    const bounds = svg.getBoundingClientRect();
    const graphX = ((event.clientX - bounds.left) / bounds.width) * width;
    cursorX = Math.min(Math.max(graphX, padding.left), width - padding.right);
    const targetDistance =
      minDistance +
      ((graphX - padding.left) / chartWidth) * (maxDistance - minDistance);
    const nearest = validPoints.reduce((closest, point) =>
      Math.abs(point.distance - targetDistance) <
      Math.abs(closest.distance - targetDistance)
        ? point
        : closest,
    );
    if (hoveredPoint?.time === nearest.time) return;
    hoveredPoint = nearest;
    onPointHover?.(nearest);
  }

  function clearGraphHover() {
    hoveredPoint = null;
    cursorX = null;
    onPointHover?.(null);
  }
</script>

<section class="activity-profile" aria-label="Elevation profile">
  {#if validPoints.length > 1}
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Elevation by distance"
      onpointermove={handleGraphMove}
      onpointerleave={clearGraphHover}
    >
      <defs>
        <linearGradient id="profile-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#8bae94" stop-opacity="0.48" />
          <stop offset="1" stop-color="#e5f2e8" stop-opacity="0.1" />
        </linearGradient>
      </defs>
      {#each ticks as tick}
        <line
          class="profile-grid"
          x1={padding.left}
          x2={width - padding.right}
          y1={y(tick)}
          y2={y(tick)}
        />
        <text
          class="profile-axis"
          x={padding.left - 9}
          y={y(tick) + 4}
          text-anchor="end">{tick} m</text
        >
      {/each}
      {#each kilometerLines as line}
        <line
          class="profile-kilometer-grid"
          x1={x(line.distance)}
          x2={x(line.distance)}
          y1={padding.top}
          y2={padding.top + chartHeight}
        />
        <text
          class="profile-kilometer-label"
          x={x(line.distance)}
          y={height - 8}
          text-anchor="middle">{line.kilometer}</text
        >
      {/each}
      {#if selectionStart && selectionEnd}
        <rect
          class="profile-selection"
          x={x(selectionStart.distance)}
          y={padding.top}
          width={Math.max(
            x(selectionEnd.distance) - x(selectionStart.distance),
            3,
          )}
          height={chartHeight}
        />
      {/if}
      <path class="profile-area" d={areaPath} />
      <path class="profile-line" d={profilePath} />
      {#if selectionStart && selectionEnd}
        <path
          class="profile-selected-line"
          d={selectedPoints
            .map(
              (point, index) =>
                `${index === 0 ? "M" : "L"} ${x(point.distance)} ${y(point.altitude)}`,
            )
            .join(" ")}
        />
      {/if}
      {#if displayedPoint}
        <line
          class="profile-hover-line"
          x1={hoveredX}
          x2={hoveredX}
          y1={padding.top}
          y2={padding.top + chartHeight}
        />
        <circle class="profile-hover-point" cx={hoveredX} cy={hoveredY} r="5" />
        <g
          class="profile-tooltip"
          transform={`translate(${tooltipX} ${tooltipY})`}
        >
          <rect
            width="158"
            height={displayedPoint.heartRate == null ? 73 : 91}
            rx="3"
          />
          <text x="10" y="19"
            ><tspan class="profile-tooltip-label">Dist: </tspan><tspan
              class="profile-tooltip-value"
              >{(displayedPoint.distance / 1000).toFixed(2)} km</tspan
            ></text
          >
          <text x="10" y="37"
            ><tspan class="profile-tooltip-label">Elev: </tspan><tspan
              class="profile-tooltip-value"
              >{Math.round(displayedPoint.altitude)} m</tspan
            ></text
          >
          <text x="10" y="55"
            ><tspan class="profile-tooltip-label">Pace: </tspan><tspan
              class="profile-tooltip-value">{paceText(pointPace)}</tspan
            ></text
          >
          {#if displayedPoint.heartRate != null}<text x="10" y="73"
              ><tspan class="profile-tooltip-label">HR: </tspan><tspan
                class="profile-tooltip-value"
                >{displayedPoint.heartRate} bpm</tspan
              ></text
            >{/if}
        </g>
      {/if}
      <line
        class="profile-axis-line"
        x1={padding.left}
        x2={width - padding.right}
        y1={padding.top + chartHeight}
        y2={padding.top + chartHeight}
      />
      <text class="profile-distance-label" x={padding.left} y={height - 8}
        >0 km</text
      >
    </svg>
  {:else}
    <div class="activity-profile-empty">
      No elevation samples available for this activity.
    </div>
  {/if}
</section>
