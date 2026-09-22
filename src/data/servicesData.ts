import { Service } from '../types';

export const SERVICES_DATA: Service[] = [
  {
    id: 'srv-ac-repair',
    slug: 'ac-repair',
    name: 'AC Repair & Servicing',
    shortDescription: 'Professional AC repair and servicing for common cooling, electrical, gas leakage and performance problems.',
    fullDescription: 'AC performance can decrease for different reasons, including cooling problems, dirty coils, gas leakage, electrical faults, or capacitor breakdown. ElectroFix BD provides comprehensive AC inspection, master jet pressure pump cleaning, gas charging, and electronic circuit board repair directly at your home in Dhaka.',
    commonProblems: [
      'AC not cooling properly or blowing warm air',
      'Weak airflow from indoor blower',
      'Water leaking from indoor AC unit',
      'Unusual noise or heavy vibration during operation',
      'AC not turning on or tripping the electrical breaker',
      'Compressor turns off frequently after few minutes',
      'Remote sensor or control display error codes'
    ],
    serviceProcess: [
      'Customer Request & Initial Symptom Discussion',
      'Prompt Technician Home Visit Across Dhaka',
      'Comprehensive Inspection & Diagnostic Pressure Testing',
      'Clear Explanation of Issues & Transparent Cost Estimate',
      'Precision Repair, Coil Cleaning or Gas Charging',
      'Temperature Drop & Airflow Verification Testing'
    ],
    coverImage: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=1200&q=80',
    isActive: true
  },
  {
    id: 'srv-refrigerator-repair',
    slug: 'refrigerator-repair',
    name: 'Refrigerator / Fridge Repair',
    shortDescription: 'Refrigerator repair and servicing for cooling issues, electrical faults, unusual noise, defrosting and compressor failure.',
    fullDescription: 'A malfunctioning refrigerator can spoil food and cause immense inconvenience. ElectroFix BD diagnoses and fixes inverter and non-inverter refrigerators, deep freezers, and side-by-side models. From thermostat and defrost timer replacements to compressor relay and gas recharge, our 10+ years experienced technicians get your fridge running properly.',
    commonProblems: [
      'Refrigerator not cooling at all or lower chamber warm',
      'Freezer not freezing properly or uneven cooling',
      'Excessive ice formation or frost buildup blocking air vents',
      'Unusual humming, clicking, or rattling noise from compressor',
      'Water pooling inside vegetable box or leaking on the floor',
      'Appliance not turning on or electrical current on the body',
      'Rubber gasket loose causing cold air loss'
    ],
    serviceProcess: [
      'Booking Received via Website or Direct Phone Call',
      'Technician Arrives at Your Home with Testing Tools',
      'Thorough Electrical, Compressor & Gas Cycle Diagnostics',
      'Upfront Estimate with Component Options',
      'Careful Sensor/Relay Replacement or Leak Repair',
      'Cooling Stabilization Check & Operational Advice'
    ],
    coverImage: 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=1200&q=80',
    isActive: true
  },
  {
    id: 'srv-washing-machine-repair',
    slug: 'washing-machine-repair',
    name: 'Washing Machine Repair',
    shortDescription: 'Expert repair and servicing for front-load, top-load and semi-automatic washing machine drainage, spinning and motor problems.',
    fullDescription: 'Washing machine breakdowns can disrupt your household routine. We repair front-load and top-load automatic machines from major brands (LG, Samsung, Whirlpool, Haier, Singer, Walton, etc.). We solve drum spinning failures, water inlet issues, noisy bearing problems, and digital motherboard faults.',
    commonProblems: [
      'Washing machine not starting or power light dead',
      'Water not entering the machine or slow fill',
      'Water not draining out (E20 / OE error codes)',
      'Drum not spinning or stopping mid-cycle (UE / DE errors)',
      'Excessive vibration and banging noise during spin cycle',
      'Door lock jammed or door latch switch broken',
      'Water leaking from bottom of machine during wash'
    ],
    serviceProcess: [
      'Service Booking with Brand & Error Code Details',
      'Technician Phone Consultation & Home Arrival',
      'Mechanical & Electronic Diagnostic Testing',
      'Belt, Pump, Bearing, or Valve Replacement',
      'Full Wash & High-Speed Spin Cycle Test',
      'Maintenance Tips to Prevent Scale & Odor'
    ],
    coverImage: 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=1200&q=80',
    isActive: true
  },
  {
    id: 'srv-oven-repair',
    slug: 'oven-repair',
    name: 'Oven / Microwave Oven Repair',
    shortDescription: 'Safe, certified repair for heating failures, spark issues, turntable plate, touch panel and electrical faults in ovens.',
    fullDescription: 'Microwave and convection ovens operate under high voltage and dangerous capacitance. It is essential not to open them without specialized tools and training. ElectroFix BD safely discharges and tests magnetrons, high-voltage diodes, capacitors, thermal cutoffs, and digital touch controls to bring your oven back to life.',
    commonProblems: [
      'Oven turning on and rotating but food remains completely cold',
      'Sparks, smoke or burning smell inside the heating cavity',
      'Turntable glass plate not rotating',
      'Touch panel unresponsive or buttons not registering',
      'Display screen blank or flickering error code',
      'Door switch failure (oven stops when door is touched)',
      'Circuit breaker trips immediately when start button is pressed'
    ],
    serviceProcess: [
      'Booking Submission with Symptom Description',
      'Qualified Technician Home Visit',
      'Safety Discharge of High-Voltage Capacitors',
      'Magnetron, Diode, Fuse & Board Continuity Testing',
      'Defective Component Replacement & Seal Inspection',
      'Heat Test & Radiation Leakage Safety Check'
    ],
    coverImage: 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&w=1200&q=80',
    isActive: true
  },
  {
    id: 'srv-dishwasher-repair',
    slug: 'dishwasher-repair',
    name: 'Dishwasher Repair',
    shortDescription: 'Professional home servicing for drainage, water supply, heating element, spray arm and electronic cycle errors.',
    fullDescription: 'Modern dishwashers rely on intricate water flow sensors, heating elements, spray arm pressure, and electronic cycle programming. When dishes come out cloudy or water fails to drain, our experienced technicians diagnose the issue and restore flawless cleaning performance right in your kitchen.',
    commonProblems: [
      'Dishwasher not starting or stopping mid-cycle',
      'Water standing at the bottom / drain pump blocked',
      'Dishes coming out dirty, greasy, or with white residue',
      'Water leaking from door seal onto kitchen floor',
      'Unusual grinding or loud buzzing noise during wash cycle',
      'Water not heating up for high-temperature sanitize cycle',
      'Error code blinking on front control panel'
    ],
    serviceProcess: [
      'Customer Booking via Website or WhatsApp',
      'Technician Arrival at Specified Time in Dhaka',
      'Filter, Spray Arm & Drain Impeller Inspection',
      'Solenoid Valve, Heating Element & Sensor Testing',
      'Precision Repair or Replacement of Damaged Parts',
      'Full Operational Wash Cycle Verification'
    ],
    coverImage: 'https://images.unsplash.com/photo-1585837575652-267c041d77d4?auto=format&fit=crop&w=1200&q=80',
    isActive: true
  },
  {
    id: 'srv-circuit-board-repair',
    slug: 'circuit-board-repair',
    name: 'Circuit Board / Chip-Level Repair',
    shortDescription: 'Micro-soldering, PCB diagnostic and chip-level repair for inverter AC, fridge and washing machine motherboards.',
    fullDescription: 'Service centers often advise replacing entire motherboards at high cost when a single semiconductor, transistor, capacitor, or microchip fails. With 10+ years of dedicated chip-level electronics repair experience, ElectroFix BD performs microscopic PCB inspection, component tracing, and micro-soldering, restoring original boards at a fraction of the cost.',
    commonProblems: [
      'Appliance completely dead with no power or display response',
      'Inverter error codes (blinking LED sequence on motherboard)',
      'Voltage surge or lightning strike damage',
      'Intermittent shutoffs or erratic program behavior',
      'Relay clicking continuously without starting the compressor',
      'Burned traces or short-circuited IC on control board',
      'Microcontroller communication error between indoor and outdoor units'
    ],
    serviceProcess: [
      'Appliance Inspection & Motherboard Extraction',
      'Microscopic PCB Trace & Multi-Meter Diagnostics',
      'Faulty Transistor, IC, Diode or Capacitor Identification',
      'Precision Chip-Level Micro-Soldering & Component Replacement',
      'Bench Power Supply & Simulated Load Testing',
      'Re-installation in Appliance & Full Live Verification'
    ],
    coverImage: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
    isActive: true
  }
];

export function getServiceBySlug(slug: string): Service | undefined {
  return SERVICES_DATA.find((s) => s.slug === slug);
}

export function getServiceById(id: string): Service | undefined {
  return SERVICES_DATA.find((s) => s.id === id);
}
