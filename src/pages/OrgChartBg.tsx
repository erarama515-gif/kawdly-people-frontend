/**
 * Decorative SVG org-chart network background for the login page.
 * Ported from the Kawdly Login v12 design component. Purely presentational,
 * aria-hidden, pointer-events-none. Renders a stylised org tree with
 * Arabic department labels and connecting lines at fixed viewport-centred
 * coordinates.
 */
export function OrgChartBg() {
  return (
    <svg
      aria-hidden="true"
      direction="ltr"
      width="2400"
      height="1200"
      viewBox="0 0 2400 1200"
      fill="none"
      className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
      style={{ marginLeft: -1200, marginTop: -600 }}
    >
      {/* Fonts come from the --font-sans token (system stack) — never a webfont;
          this SVG also renders inside the offline-first Electron shell. */}
      <style>{`text{font-family:var(--font-sans);fill:#5b6778;text-anchor:middle}.m{font-family:ui-monospace,'Cascadia Mono','Segoe UI Mono','SFMono-Regular',monospace;font-size:10px;letter-spacing:1.2px}`}</style>
      <g transform="translate(1200 600)" strokeWidth="1">
        {/* Main connectors */}
        <g stroke="#c3ccd6">
          <path d="M0 -340L-684 -340L-700 -324L-700 520" />
          <path d="M0 -340L684 -340L700 -324L700 520" />
          <path d="M0 -340V-270" />
          <path d="M-700 -230L-430 -230" />
          <path d="M-700 150L-560 150" />
          <path d="M-700 360L-330 360" />
          <path d="M700 -250L460 -250" />
          <path d="M700 120L590 120" />
          <path d="M700 350L380 350" />
          <path d="M-700 -60L-950 -60" />
          <path d="M700 -120L980 -120" />
          <path d="M-700 520V700M700 520V700M-700 -340H-1200M700 -340H1200" strokeDasharray="3 5" />
        </g>

        {/* Highlighted path */}
        <g stroke="#0f4a73" strokeOpacity=".7" strokeWidth="1.6">
          <path d="M0 -270L0 -324L-16 -340L-684 -340L-700 -324L-700 134L-684 150L-560 150" />
          <path d="M-224 0L-410 0" />
          <path d="M-410 0L-410 140L-420 150L-560 150" />
        </g>

        {/* Cluster: HR (left-top) */}
        <g opacity=".5">
          {/* Legal branch */}
          <path d="M-950 -60L-986.9 -60L-996.9 -50L-996.9 76.9" stroke="#c3ccd6" />
          <circle cx="-965.9" cy="74.8" r="2.2" fill="#0f4a73" fillOpacity=".7" />
          <path d="M-996.9 76.9L-1029.5 82.9" stroke="#d3d9e1" />
          <circle cx="-1029.5" cy="82.9" r="2.2" fill="#0f4a73" fillOpacity=".7" />
          <circle cx="-996.9" cy="76.9" r="4.5" fill="#f4f5f7" stroke="#0f4a73" strokeWidth="1.4" />

          {/* Legal sub-branch */}
          <path d="M-950 -60L-1060.2 -60L-1060.9 -59.3L-1060.9 -58.5" stroke="#c3ccd6" />
          <path d="M-1060.9 -58.5L-1031 -61.1" stroke="#d3d9e1" />
          <circle cx="-1031" cy="-61.1" r="2.2" fill="#0f4a73" fillOpacity=".7" />
          <circle cx="-1086.4" cy="-71.8" r="2.2" fill="#0f4a73" fillOpacity=".7" />
          <circle cx="-1060.9" cy="-58.5" r="4.5" fill="#f4f5f7" stroke="#0f4a73" strokeWidth="1.4" />

          {/* Legal upper-branch */}
          <path d="M-950 -60L-960.7 -60L-970.7 -70L-970.7 -157.2" stroke="#c3ccd6" />
          <path d="M-970.7 -157.2L-941 -149.7" stroke="#d3d9e1" />
          <circle cx="-941" cy="-149.7" r="2.2" fill="#0f4a73" fillOpacity=".7" />
          <path d="M-970.7 -157.2L-994.5 -152.3" stroke="#d3d9e1" />
          <circle cx="-994.5" cy="-152.3" r="2.2" fill="#0f4a73" fillOpacity=".7" />
          <circle cx="-970.7" cy="-157.2" r="4.5" fill="#f4f5f7" stroke="#0f4a73" strokeWidth="1.4" />

          <circle cx="-1053" cy="88.7" r="1.8" fill="#9aa6b5" />
          <circle cx="-1048.9" cy="-237.2" r="1.8" fill="#9aa6b5" />
          <rect x="-955" y="-65" width="10" height="10" fill="#0f4a73" />

          {/* Training branch */}
          <path d="M980 -120L980.3 -120L980.6 -120.3L980.6 -243.3" stroke="#c3ccd6" />
          <path d="M980.6 -243.3L1001.2 -250.9" stroke="#d3d9e1" />
          <circle cx="1001.2" cy="-250.9" r="2.2" fill="#0f4a73" fillOpacity=".7" />
          <circle cx="980.6" cy="-243.3" r="4.5" fill="#f4f5f7" stroke="#0f4a73" strokeWidth="1.4" />

          <path d="M980 -120L1080.3 -120L1089.5 -129.2L1089.5 -138.3" stroke="#c3ccd6" />
          <circle cx="1107.8" cy="-139.3" r="2.2" fill="#0f4a73" fillOpacity=".7" />
          <circle cx="1089.5" cy="-138.3" r="4.5" fill="#f4f5f7" stroke="#0f4a73" strokeWidth="1.4" />

          <path d="M980 -120L1005.7 -120L1015.7 -110L1015.7 -35.5" stroke="#c3ccd6" />
          <circle cx="1035.9" cy="-39.8" r="2.2" fill="#0f4a73" fillOpacity=".7" />
          <circle cx="1015.7" cy="-35.5" r="4.5" fill="#f4f5f7" stroke="#0f4a73" strokeWidth="1.4" />

          <rect x="975" y="-125" width="10" height="10" fill="#0f4a73" />
        </g>

        {/* HR cluster */}
        <path d="M-430 -230L-475.7 -230L-485.7 -220L-485.7 -121.7" stroke="#c3ccd6" />
        <circle cx="-485.7" cy="-121.7" r="4.5" fill="#f4f5f7" stroke="#0f4a73" strokeWidth="1.4" />
        <path d="M-485.7 -121.7L-474.8 -94.4" stroke="#d3d9e1" />
        <circle cx="-474.8" cy="-94.4" r="2.2" fill="#0f4a73" fillOpacity=".7" />
        <path d="M-485.7 -121.7L-497.9 -106.4" stroke="#d3d9e1" />
        <circle cx="-497.9" cy="-106.4" r="2.2" fill="#0f4a73" fillOpacity=".7" />
        <path d="M-485.7 -121.7L-505.8 -133.9" stroke="#d3d9e1" />
        <circle cx="-505.8" cy="-133.9" r="2.2" fill="#0f4a73" fillOpacity=".7" />

        <path d="M-430 -230L-555 -230L-555.4 -229.6L-555.4 -229.2" stroke="#c3ccd6" />
        <circle cx="-555.4" cy="-229.2" r="4.5" fill="#f4f5f7" stroke="#0f4a73" strokeWidth="1.4" />
        <circle cx="-542.8" cy="-203.7" r="2.2" fill="#0f4a73" fillOpacity=".7" />
        <circle cx="-572.3" cy="-237.7" r="2.2" fill="#0f4a73" fillOpacity=".7" />

        <path d="M-430 -230L-472.6 -230L-482.6 -240L-482.6 -340.4" stroke="#c3ccd6" />
        <circle cx="-482.6" cy="-340.4" r="4.5" fill="#f4f5f7" stroke="#0f4a73" strokeWidth="1.4" />
        <circle cx="-473" cy="-326.9" r="2.2" fill="#0f4a73" fillOpacity=".7" />
        <circle cx="-501.1" cy="-322.3" r="2.2" fill="#0f4a73" fillOpacity=".7" />

        <path d="M-430 -230L-394.3 -230L-384.3 -240L-384.3 -342.9" stroke="#c3ccd6" />
        <circle cx="-384.3" cy="-342.9" r="4.5" fill="#f4f5f7" stroke="#0f4a73" strokeWidth="1.4" />
        <circle cx="-361.2" cy="-343.5" r="2.2" fill="#0f4a73" fillOpacity=".7" />
        <circle cx="-396.2" cy="-358" r="2.2" fill="#0f4a73" fillOpacity=".7" />
        <rect x="-435" y="-235" width="10" height="10" fill="#0f4a73" />

        {/* Centre node */}
        <circle cx="-410" cy="0" r="4.5" fill="#f4f5f7" stroke="#0f4a73" strokeWidth="1.4" />
        <circle cx="-386.1" cy="-3.8" r="2.2" fill="#0f4a73" fillOpacity=".7" />
        <circle cx="-383.8" cy="16.5" r="2.2" fill="#0f4a73" fillOpacity=".7" />
        <circle cx="-414.2" cy="17.6" r="2.2" fill="#0f4a73" fillOpacity=".7" />
        <circle cx="-434.3" cy="-14.1" r="2.2" fill="#0f4a73" fillOpacity=".7" />
        <path d="M-410 0L-386.1 -3.8" stroke="#d3d9e1" />
        <path d="M-410 0L-383.8 16.5" stroke="#d3d9e1" />
        <path d="M-410 0L-414.2 17.6" stroke="#d3d9e1" />
        <path d="M-410 0L-434.3 -14.1" stroke="#d3d9e1" />

        {/* Operations cluster */}
        <path d="M-560 150L-654.2 150L-664.2 160L-664.2 180.1" stroke="#c3ccd6" />
        <circle cx="-664.2" cy="180.1" r="4.5" fill="#f4f5f7" stroke="#0f4a73" strokeWidth="1.4" />
        <circle cx="-659.9" cy="214.3" r="2.2" fill="#0f4a73" fillOpacity=".7" />
        <circle cx="-692.7" cy="174.1" r="2.2" fill="#0f4a73" fillOpacity=".7" />

        <path d="M-560 150L-586.4 150L-596.4 140L-596.4 67.1" stroke="#c3ccd6" />
        <circle cx="-596.4" cy="67.1" r="4.5" fill="#f4f5f7" stroke="#0f4a73" strokeWidth="1.4" />
        <circle cx="-566.8" cy="60.5" r="2.2" fill="#0f4a73" fillOpacity=".7" />
        <circle cx="-576.1" cy="85" r="2.2" fill="#0f4a73" fillOpacity=".7" />
        <rect x="-565" y="145" width="10" height="10" fill="#0f4a73" />

        {/* Finance cluster */}
        <path d="M-330 360L-302.9 360L-292.9 370L-292.9 486.9" stroke="#c3ccd6" />
        <circle cx="-292.9" cy="486.9" r="4.5" fill="#f4f5f7" stroke="#0f4a73" strokeWidth="1.4" />
        <circle cx="-274.8" cy="480.1" r="2.2" fill="#0f4a73" fillOpacity=".7" />
        <circle cx="-276.2" cy="504.6" r="2.2" fill="#0f4a73" fillOpacity=".7" />
        <circle cx="-314" cy="478.5" r="2.2" fill="#0f4a73" fillOpacity=".7" />

        <path d="M-330 360L-457.2 360L-467.2 350L-467.2 312.7" stroke="#c3ccd6" />
        <circle cx="-467.2" cy="312.7" r="4.5" fill="#f4f5f7" stroke="#0f4a73" strokeWidth="1.4" />
        <circle cx="-438.4" cy="314.2" r="2.2" fill="#0f4a73" fillOpacity=".7" />
        <circle cx="-498.2" cy="322" r="2.2" fill="#0f4a73" fillOpacity=".7" />
        <rect x="-335" y="355" width="10" height="10" fill="#0f4a73" />

        {/* Technology cluster */}
        <path d="M460 -250L410.4 -250L400.4 -260L400.4 -325.1" stroke="#c3ccd6" />
        <circle cx="400.4" cy="-325.1" r="4.5" fill="#f4f5f7" stroke="#0f4a73" strokeWidth="1.4" />
        <circle cx="418.7" cy="-329.5" r="2.2" fill="#0f4a73" fillOpacity=".7" />
        <circle cx="375.2" cy="-332.7" r="2.2" fill="#0f4a73" fillOpacity=".7" />

        <path d="M460 -250L492.8 -250L502.8 -260L502.8 -371" stroke="#c3ccd6" />
        <circle cx="502.8" cy="-371" r="4.5" fill="#f4f5f7" stroke="#0f4a73" strokeWidth="1.4" />
        <circle cx="477.6" cy="-368.8" r="2.2" fill="#0f4a73" fillOpacity=".7" />
        <circle cx="496.5" cy="-389.7" r="2.2" fill="#0f4a73" fillOpacity=".7" />

        <path d="M460 -250L563.2 -250L573.2 -260L573.2 -302.2" stroke="#c3ccd6" />
        <circle cx="573.2" cy="-302.2" r="4.5" fill="#f4f5f7" stroke="#0f4a73" strokeWidth="1.4" />
        <circle cx="598.6" cy="-292.9" r="2.2" fill="#0f4a73" fillOpacity=".7" />
        <circle cx="567.8" cy="-322.9" r="2.2" fill="#0f4a73" fillOpacity=".7" />

        <path d="M460 -250L570.5 -250L580.5 -240L580.5 -195.1" stroke="#c3ccd6" />
        <circle cx="580.5" cy="-195.1" r="4.5" fill="#f4f5f7" stroke="#0f4a73" strokeWidth="1.4" />
        <circle cx="599.2" cy="-196.9" r="2.2" fill="#0f4a73" fillOpacity=".7" />
        <circle cx="552.2" cy="-173.2" r="2.2" fill="#0f4a73" fillOpacity=".7" />

        <path d="M460 -250L503.8 -250L513.8 -240L513.8 -125.3" stroke="#c3ccd6" />
        <circle cx="513.8" cy="-125.3" r="4.5" fill="#f4f5f7" stroke="#0f4a73" strokeWidth="1.4" />
        <circle cx="532.3" cy="-126.6" r="2.2" fill="#0f4a73" fillOpacity=".7" />
        <circle cx="487.2" cy="-142.5" r="2.2" fill="#0f4a73" fillOpacity=".7" />
        <rect x="455" y="-255" width="10" height="10" fill="#0f4a73" />

        {/* Attendance cluster */}
        <path d="M590 120L430 120L420 110L420 0" stroke="#c3ccd6" />
        <circle cx="420" cy="0" r="4.5" fill="#f4f5f7" stroke="#0f4a73" strokeWidth="1.4" />
        <circle cx="450.1" cy="-2.8" r="2.2" fill="#0f4a73" fillOpacity=".7" />
        <circle cx="435.2" cy="31.9" r="2.2" fill="#0f4a73" fillOpacity=".7" />
        <circle cx="403.7" cy="4.8" r="2.2" fill="#0f4a73" fillOpacity=".7" />
        <path d="M420 0L450.1 -2.8" stroke="#d3d9e1" />
        <path d="M420 0L435.2 31.9" stroke="#d3d9e1" />

        <path d="M590 120L728.9 120L734.7 125.8L734.7 131.7" stroke="#c3ccd6" />
        <circle cx="734.7" cy="131.7" r="4.5" fill="#f4f5f7" stroke="#0f4a73" strokeWidth="1.4" />
        <circle cx="754.5" cy="139" r="2.2" fill="#0f4a73" fillOpacity=".7" />

        <path d="M590 120L581.8 120L573.7 128.2L573.7 216.7" stroke="#c3ccd6" />
        <circle cx="573.7" cy="216.7" r="4.5" fill="#f4f5f7" stroke="#0f4a73" strokeWidth="1.4" />
        <circle cx="599.8" cy="223.2" r="2.2" fill="#0f4a73" fillOpacity=".7" />
        <circle cx="553.1" cy="230.5" r="2.2" fill="#0f4a73" fillOpacity=".7" />
        <rect x="585" y="115" width="10" height="10" fill="#0f4a73" />

        {/* Sales cluster */}
        <path d="M380 350L454.4 350L464.4 340L464.4 309.6" stroke="#c3ccd6" />
        <circle cx="464.4" cy="309.6" r="4.5" fill="#f4f5f7" stroke="#0f4a73" strokeWidth="1.4" />
        <circle cx="486.1" cy="316.9" r="2.2" fill="#0f4a73" fillOpacity=".7" />
        <circle cx="438.2" cy="286.2" r="2.2" fill="#0f4a73" fillOpacity=".7" />

        <path d="M380 350L361.1 350L351.1 360L351.1 491.9" stroke="#c3ccd6" />
        <circle cx="351.1" cy="491.9" r="4.5" fill="#f4f5f7" stroke="#0f4a73" strokeWidth="1.4" />
        <circle cx="369.4" cy="497.1" r="2.2" fill="#0f4a73" fillOpacity=".7" />
        <circle cx="329.4" cy="500.6" r="2.2" fill="#0f4a73" fillOpacity=".7" />
        <rect x="375" y="345" width="10" height="10" fill="#0f4a73" />

        {/* Centre anchor (main link nodes) */}
        <path d="M224 0L420 0" stroke="#c3ccd6" />
        <path d="M420 0L420 110L430 120L590 120" stroke="#c3ccd6" />

        <rect x="-6" y="-346" width="12" height="12" fill="#0f4a73" />
        <circle cx="-224" cy="0" r="8" fill="#f4f5f7" stroke="#0f4a73" strokeWidth="1.5" />
        <circle cx="-224" cy="0" r="3.5" fill="#0f4a73" />
        <circle cx="224" cy="0" r="8" fill="#f4f5f7" stroke="#0f4a73" strokeWidth="1.5" />
        <circle cx="224" cy="0" r="3.5" fill="#0f4a73" />

        {/* Arabic labels */}
        <text x="-430" y="-246" fontSize="14" fontWeight="600" fill="#0f1f35">{"الموارد البشرية"}</text>
        <text x="-430" y="-204" className="m">HUMAN RESOURCES</text>
        <text x="-560" y="134" fontSize="14" fontWeight="600" fill="#0f1f35">{"العمليات"}</text>
        <text x="-560" y="176" className="m">OPERATIONS</text>
        <text x="-330" y="344" fontSize="14" fontWeight="600" fill="#0f1f35">{"المالية"}</text>
        <text x="-330" y="386" className="m">FINANCE</text>
        <text x="460" y="-266" fontSize="14" fontWeight="600" fill="#0f1f35">{"التقنية"}</text>
        <text x="460" y="-224" className="m">TECHNOLOGY</text>
        <text x="590" y="104" fontSize="14" fontWeight="600" fill="#0f1f35">{"الحضور"}</text>
        <text x="590" y="146" className="m">ATTENDANCE</text>
        <text x="380" y="334" fontSize="14" fontWeight="600" fill="#0f1f35">{"المبيعات"}</text>
        <text x="380" y="376" className="m">SALES</text>
        <text opacity=".6" x="-950" y="-76" fontSize="14" fontWeight="600" fill="#0f1f35">{"الشؤون القانونية"}</text>
        <text opacity=".6" x="-950" y="-34" className="m">LEGAL</text>
        <text opacity=".6" x="980" y="-136" fontSize="14" fontWeight="600" fill="#0f1f35">{"التدريب"}</text>
        <text opacity=".6" x="980" y="-94" className="m">LEARNING</text>
        <text x="0" y="-364" fontSize="14" fontWeight="600" fill="#0f1f35">{"المؤسسة"}</text>
        <text x="0" y="-386" className="m">ORGANIZATION</text>

        {/* Sub-labels */}
        <text x="426.7" y="-313.5" textAnchor="start" fontSize="12">{"الأفراد"}</text>
        <text x="426.7" y="-300.5" textAnchor="start" className="m">PEOPLE</text>
        <text x="410.4" y="-339.1" textAnchor="start" fontSize="12">{"الفرق"}</text>
        <text x="410.4" y="-326.1" textAnchor="start" className="m">TEAMS</text>
        <text x="-690" y="-358" textAnchor="start" fontSize="12">{"الأقسام"}</text>
        <text x="-690" y="-372" textAnchor="start" className="m">DEPARTMENTS</text>
      </g>
    </svg>
  );
}
