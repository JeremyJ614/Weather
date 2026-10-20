import { PAL } from "@/features/replay/palette";

const EF = ["EF0", "EF1", "EF2", "EF3", "EF4", "EF5", "EFU"];

function Row({ c, label, ring }: { c: string; label: string; ring?: boolean }) {
  return (
    <li>
      <i
        style={
          ring
            ? { border: `2px solid ${c}`, background: "transparent" }
            : { background: c }
        }
      />
      {label}
    </li>
  );
}

/**
 * What every mark on the replay map means (owner's Final Fix-It #17), one expandable
 * section per kind. Colors are the admin's (Map & data colors), the same the map paints.
 */
export function Legend({ chase }: { chase: boolean }) {
  return (
    <div className="map-legend">
      <details open>
        <summary>Tornadoes</summary>
        <p>
          Paths and funnels take the rating&apos;s color; the ring is the
          tornado on the ground now, drawn to its width there.
        </p>
        <ul>
          {EF.map((k) => (
            <Row
              key={k}
              c={PAL.ef[k] ?? PAL.ef.EFU}
              label={k === "EFU" ? "Unrated" : k}
            />
          ))}
        </ul>
      </details>
      <details>
        <summary>Damage survey points</summary>
        <p>
          Spots the National Weather Service surveyed, colored by the rating
          found there and larger the stronger it was. They appear as the tornado
          reaches them. Tap one for what was damaged.
        </p>
        <ul>
          {["EF0", "EF2", "EF4"].map((k) => (
            <Row key={k} c={PAL.ef[k]} label={`${k} damage`} />
          ))}
        </ul>
      </details>
      <details>
        <summary>Hail reports</summary>
        <p>
          Storm reports of hail, appearing at the time they fell; the ring grows
          and its color shifts with the size.
        </p>
        <ul>
          <Row c={PAL.hail.small} label="¾″" ring />
          <Row c={PAL.hail.mid} label="2″" ring />
          <Row c={PAL.hail.big} label="4″ and larger" ring />
        </ul>
      </details>
      <details>
        <summary>Warnings</summary>
        <p>NWS warning polygons, lit while in force and faded once expired.</p>
        <ul>
          <Row c={PAL.warn.tornado} label="Tornado warning" />
          <Row c={PAL.warn.severe} label="Severe thunderstorm warning" />
          <Row c={PAL.warn.emergency} label="Tornado emergency" />
        </ul>
      </details>
      {chase && (
        <details>
          <summary>Your chase</summary>
          <ul>
            <Row c={PAL.track.done} label="Driven so far" />
            <Row c={PAL.track.rest} label="Still to drive" />
            <Row c={PAL.track.chaser} label="The car" />
            <Row c={PAL.prox.imminent} label="Proximity ring" ring />
          </ul>
        </details>
      )}
      <details>
        <summary>Radar</summary>
        <p>
          Open Radar for its color scale: reflectivity from the national mosaic,
          or velocity, storm-relative velocity and correlation from each
          radar&apos;s own scans. It follows the replay&apos;s clock.
        </p>
      </details>
    </div>
  );
}
