import {
  AfterViewInit,
  Component,
  ElementRef,
  QueryList,
  ViewChildren,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  OnDestroy,
  OnInit
} from '@angular/core';
import { AvailabilityService, AvailabilityItem } from './services/availability.service';
import { inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, addDoc, doc, writeBatch, serverTimestamp } from '@angular/fire/firestore';
import { BusySlotsService, BusySlot } from './services/busy-slots.service';
import { take } from 'rxjs/operators';
import {
  ReservationDataService,
  BundleItem,
  ServiceItem
} from './services/reservation-data.service';
interface ReviewItem {
  name: string;
  stars: number;
  text: string;
}

interface WebsiteServiceItem {
  title: string;
  shortDescription: string;
  fullDescription: string;
  price: string;
  includes?: string[];
}

interface SelectedWebsiteServiceInfo {
  type: 'package' | 'single';
  index: number;
}
interface TransferSlotOption {
  date: Date;
  dateKey: string;
  startMinutes: number;
  endMinutes: number;
  label: string;
}
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})


export class AppComponent implements AfterViewInit, OnInit, OnDestroy {

@ViewChild('contact') contactSection!: ElementRef;

deliveryMode: 'self' | 'pickup_return' = 'self';
pickupReturnAddress = '';

pickupReturnStep: 'pickup' | 'return' = 'pickup';

pickupSlots: TransferSlotOption[] = [];
returnSlots: TransferSlotOption[] = [];

pickupAddress = '';
returnAddress = '';
returnToDifferentAddress = false;

selectedPickupDate: Date | null = null;
selectedPickupSlot: TransferSlotOption | null = null;

selectedReturnDate: Date | null = null;
selectedReturnSlot: TransferSlotOption | null = null;

selectPickupSlot(slot: TransferSlotOption): void {
  this.selectedPickupDate = slot.date;
  this.selectedPickupSlot = slot;

  this.selectedReturnDate = null;
  this.selectedReturnSlot = null;
  this.returnSlots = [];

  if (this.selectedDate) {
    const allReturnSlots = this.generateTransferSlotsForDay(this.selectedDate);

    this.returnSlots = allReturnSlots.filter(returnSlot =>
      this.canFitWashBetweenPickupAndReturn(slot, returnSlot)
    );
  }
}

selectReturnSlot(slot: TransferSlotOption): void {
  this.selectedReturnDate = slot.date;
  this.selectedReturnSlot = slot;
}
findWashWindowBetween(
  pickupSlot: TransferSlotOption,
  returnSlot: TransferSlotOption
): { startMinutes: number; endMinutes: number } | null {
  if (pickupSlot.dateKey !== returnSlot.dateKey) {
    return null;
  }

  const availability = this.availabilityItems.find(item => {
    const itemDate = this.toDate(item.date);
    return this.isSameDay(itemDate, pickupSlot.date);
  });

  if (!availability) return null;

  const workStart = this.toDate(availability.start).getHours() * 60 + this.toDate(availability.start).getMinutes();
  const workEnd = this.toDate(availability.end).getHours() * 60 + this.toDate(availability.end).getMinutes();

  const windowStart = Math.max(pickupSlot.endMinutes, workStart);
  const windowEnd = Math.min(returnSlot.startMinutes, workEnd);

  if (windowEnd - windowStart < this.totalDurationMin) {
    return null;
  }

  const relevantBusy = this.busySlots
    .filter(slot => slot.status !== 'cancelled' && slot.status !== 'canceled')
    .sort((a, b) => a.startMinutes - b.startMinutes);

  let cursor = windowStart;

  for (const slot of relevantBusy) {
    if (slot.endMinutes <= cursor) continue;
    if (slot.startMinutes >= windowEnd) break;

    if (slot.startMinutes - cursor >= this.totalDurationMin) {
      return {
        startMinutes: cursor,
        endMinutes: cursor + this.totalDurationMin
      };
    }

    cursor = Math.max(cursor, slot.endMinutes);
  }

  if (windowEnd - cursor >= this.totalDurationMin) {
    return {
      startMinutes: cursor,
      endMinutes: cursor + this.totalDurationMin
    };
  }

  return null;
}
canFitWashBetweenPickupAndReturn(
  pickupSlot: TransferSlotOption,
  returnSlot: TransferSlotOption
): boolean {
  if (pickupSlot.dateKey !== returnSlot.dateKey) {
    return false;
  }

  const washStart = pickupSlot.endMinutes;
  const washEndLimit = returnSlot.startMinutes;

  if (washEndLimit <= washStart) {
    return false;
  }

  const availability = this.availabilityItems.find(item => {
    const itemDate = this.toDate(item.date);
    return this.isSameDay(itemDate, pickupSlot.date);
  });

  if (!availability) return false;

  const workStart = this.toDate(availability.start).getHours() * 60 + this.toDate(availability.start).getMinutes();
  const workEnd = this.toDate(availability.end).getHours() * 60 + this.toDate(availability.end).getMinutes();

  const windowStart = Math.max(washStart, workStart);
  const windowEnd = Math.min(washEndLimit, workEnd);

  if (windowEnd - windowStart < this.totalDurationMin) {
    return false;
  }

  const relevantBusy = this.busySlots
    .filter(slot => slot.status !== 'cancelled' && slot.status !== 'canceled')
    .sort((a, b) => a.startMinutes - b.startMinutes);

  let cursor = windowStart;

  for (const slot of relevantBusy) {
    if (slot.endMinutes <= cursor) continue;
    if (slot.startMinutes >= windowEnd) break;

    if (slot.startMinutes - cursor >= this.totalDurationMin) {
      return true;
    }

    cursor = Math.max(cursor, slot.endMinutes);
  }

  return windowEnd - cursor >= this.totalDurationMin;
}
generateTransferSlotsForDay(day: Date): TransferSlotOption[] {
  const availability = this.availabilityItems.find(item => {
    const itemDate = this.toDate(item.date);
    return this.isSameDay(itemDate, day);
  });

  if (!availability) return [];

  const start = this.toDate(availability.start);
  const end = this.toDate(availability.end);

  const result: TransferSlotOption[] = [];
  const stepMin = 30;
  const slotDurationMin = 60;

  let current = this.roundUpToNextHalfHour(start);

  while (true) {
    const slotEnd = new Date(current.getTime() + slotDurationMin * 60000);
    if (slotEnd > end) break;

    const startMinutes = current.getHours() * 60 + current.getMinutes();
    const endMinutes = startMinutes + slotDurationMin;

    const hasConflict = this.busySlots.some(slot => {
      if (slot.status === 'cancelled' || slot.status === 'canceled') {
        return false;
      }

      return this.isTimeRangeOverlapping(
        startMinutes,
        endMinutes,
        slot.startMinutes,
        slot.endMinutes
      );
    });

    if (!hasConflict) {
      result.push({
        date: new Date(day),
        dateKey: this.formatDateKey(day),
        startMinutes,
        endMinutes,
        label: `${this.minutesToTimeString(startMinutes)}–${this.minutesToTimeString(endMinutes)}`
      });
    }

    current = new Date(current.getTime() + stepMin * 60000);
  }

  return result;
}
get effectiveReturnAddress(): string {
  return this.returnToDifferentAddress
    ? this.returnAddress.trim()
    : this.pickupAddress.trim();
}
onDeliveryModeChange(): void {
  this.selectedDate = null;
  this.selectedTime = null;
  this.timeSlots = [];
  this.selectedDateKey = null;

  this.resetPickupReturnCalendarState();

  if (this.deliveryMode === 'self') {
    this.pickupAddress = '';
    this.returnAddress = '';
    this.returnToDifferentAddress = false;
  }
}

hasBusyConflict(startMin: number, endMin: number): boolean {
  return this.busySlots.some(slot => {
    if (slot.status === 'cancelled' || slot.status === 'canceled') {
      return false;
    }

    return this.isTimeRangeOverlapping(
      startMin,
      endMin,
      slot.startMinutes,
      slot.endMinutes
    );
  });
}

roundMinutesUpToNextHalfHour(totalMin: number): number {
  const remainder = totalMin % 30;
  if (remainder === 0) return totalMin;
  return totalMin + (30 - remainder);
}


websitePackages: WebsiteServiceItem[] = [
  {
    title: 'Mini paketas',
    shortDescription: 'Greitas ir tvarkingas automobilio atnaujinimas kasdienai.',
    fullDescription:
      'Puikus pasirinkimas tiems, kas nori greitai atgaivinti automobilio išvaizdą be pilno detailing proceso. Tinka reguliariai priežiūrai ir kasdien naudojamiems automobiliams.',
    price: 'nuo 60 €',
    includes: ['Rankinis kėbulo plovimas', 'Saugus džiovinimas', 'Salono siurbimas', 'Kilimėlių valymas', 'Dulkių nuvalymas', 'Langų valymas (viduje ir išorėje)', 'Vaškas (kėbulo apsauga)']
  },
  {
    title: 'Standartinis paketas',
    shortDescription: 'Populiariausias variantas kruopščiam salono ir išorės sutvarkymui.',
    fullDescription:
      'Subalansuotas paketas klientams, kurie nori ne tik švaros, bet ir ryškesnio vizualinio rezultato. Idealiai tinka sezoniniam atnaujinimui arba prieš pardavimą.',
    price: 'nuo 90 €',
    includes: [ 'Viskas iš Mini paketo', 'Detalus salono valymas', 'Plastiko valymas + apsauga', 'Bagažinės valymas', 'Detalus ratlankių ir arkų valymas']
  },
  {
    title: 'Premium paketas',
    shortDescription: 'Maksimalus efektas tiems, kas nori geriausio rezultato.',
    fullDescription:
      'Pilnas detailing paketas reikliems klientams. Daugiau dėmesio detalėms, daugiau kruopštumo, daugiau vizualinio efekto. Tinka tiems, kas nori, kad automobilis atrodytų kuo geriau.',
    price: 'nuo 180 €',
    includes: [ 'Viskas iš Standartinio paketo', 'Sėdynių cheminis valymas + dėmių šalinimas', 'Tefloninė danga (premium kėbulo apsauga)']
  }
];

websiteSingleServices: WebsiteServiceItem[] = [
  // {
  //   title: 'Išorės plovimas',
  //   shortDescription: 'Saugus rankinis automobilio išorės plovimas.',
  //   fullDescription:
  //     'Kruopštus rankinis plovimas naudojant profesionalias priemones, skirtas saugiai pašalinti nešvarumus nuo kėbulo, ratlankių ir kitų išorės paviršių.',
  //   price: 'nuo 25 €',
  //   includes: ['Kėbulas', 'Ratų valymas', 'Saugios priemonės']
  // },
  // {
  //   title: 'Salono valymas',
  //   shortDescription: 'Kasdienis salono atnaujinimas ir švaros sugrąžinimas.',
  //   fullDescription:
  //     'Išvalomos pagrindinės salono zonos: grindys, kilimėliai, sėdynės, panelė ir kiti paviršiai. Puikus pasirinkimas norint palaikyti švarų ir malonų saloną.',
  //   price: 'nuo 35 €',
  //   includes: ['Siurbimas', 'Paviršių valymas', 'Kilimėliai']
  // },
  // {
  //   title: 'Giluminis salono valymas',
  //   shortDescription: 'Gilesnis salono valymas stipresniems nešvarumams.',
  //   fullDescription:
  //     'Skirta automobiliams, kurių salonas reikalauja daugiau dėmesio. Valomos sunkiau pasiekiamos vietos, pašalinami įsisenėję nešvarumai ir atgaivinama bendra salono išvaizda.',
  //   price: 'nuo 89 €',
  //   includes: ['Gilesnis valymas', 'Dėmės', 'Daugiau dėmesio detalėms']
  // },
  // {
  //   title: 'Sėdynių cheminis valymas',
  //   shortDescription: 'Audinių ar tekstilinių sėdynių valymas cheminiu būdu.',
  //   fullDescription:
  //     'Efektyvus būdas pašalinti dėmes, kvapus ir giliai įsigėrusius nešvarumus iš tekstilinių sėdynių, grąžinant joms gaivesnę ir tvarkingesnę būklę.',
  //   price: 'nuo 49 €',
  //   includes: ['Dėmių mažinimas', 'Kvapo gaivinimas', 'Tekstilės priežiūra']
  // },
  // {
  //   title: 'Odos valymas ir impregnavimas',
  //   shortDescription: 'Odinio salono priežiūra ir apsauga.',
  //   fullDescription:
  //     'Oda išvaloma specialiomis priemonėmis, po to padengiama apsauginiu sluoksniu, kuris padeda ilgiau išlaikyti minkštumą, švarą ir estetinę išvaizdą.',
  //   price: 'nuo 59 €',
  //   includes: ['Odos valymas', 'Maitinimas', 'Apsauga']
  // },
  // {
  //   title: 'Variklio skyriaus valymas',
  //   shortDescription: 'Tvarkingas ir saugus variklio skyriaus sutvarkymas.',
  //   fullDescription:
  //     'Atsargus variklio skyriaus valymas naudojant tam pritaikytas priemones. Tikslas yra pašalinti dulkes, purvą ir suteikti tvarkingesnę bendrą išvaizdą.',
  //   price: 'nuo 39 €',
  //   includes: ['Saugus valymas', 'Plastikų atgaivinimas', 'Tvarkingas vaizdas']
  // },
  // {
  //   title: 'Vieno etapo poliravimas',
  //   shortDescription: 'Blizgesio atnaujinimas ir smulkių defektų sumažinimas.',
  //   fullDescription:
  //     'Lengvas dažų paviršiaus atnaujinimas, skirtas pagerinti blizgesį ir sumažinti smulkių įbrėžimų bei hologramų matomumą.',
  //   price: 'nuo 149 €',
  //   includes: ['Blizgesio atkūrimas', 'Smulkūs defektai', 'Vizualinis efektas']
  // },
  // {
  //   title: 'Dviejų etapų poliravimas',
  //   shortDescription: 'Gilesnis dažų koregavimas geresniam rezultatui.',
  //   fullDescription:
  //     'Išsamesnis poliravimo procesas, leidžiantis efektyviau sumažinti matomus defektus ir išgauti ryškesnį, gilesnį automobilio blizgesį.',
  //   price: 'nuo 249 €',
  //   includes: ['Dažų korekcija', 'Ryškesnis blizgesys', 'Didesnis efektas']
  // },
  // {
  //   title: 'Keraminė danga',
  //   shortDescription: 'Dažų paviršiaus apsauga ir lengvesnė priežiūra.',
  //   fullDescription:
  //     'Keraminė danga padeda apsaugoti automobilio paviršių nuo aplinkos poveikio, palengvina priežiūrą ir suteikia išraiškingesnį blizgesį.',
  //   price: 'nuo 299 €',
  //   includes: ['Paviršiaus apsauga', 'Lengvesnė priežiūra', 'Hidrofobinis efektas']
  // },
  // {
  //   title: 'Žibintų poliravimas',
  //   shortDescription: 'Pagerina žibintų išvaizdą ir skaidrumą.',
  //   fullDescription:
  //     'Pašalinamas apsiblausimas ir paviršiaus oksidacija, kad žibintai atrodytų tvarkingiau ir šviesa sklistų švariau.',
  //   price: 'nuo 39 €',
  //   includes: ['Skaidrumas', 'Tvarkingesnė išvaizda', 'Atnaujinimas']
  // },
  // {
  //   title: 'Apsauginis vaškas',
  //   shortDescription: 'Greita išorės apsauga ir papildomas blizgesys.',
  //   fullDescription:
  //     'Apsauginio vaško sluoksnis suteikia malonų vizualinį efektą, padeda lengviau palaikyti švarą ir papildo automobilio priežiūros procesą.',
  //   price: 'nuo 29 €',
  //   includes: ['Blizgesys', 'Trumpalaikė apsauga', 'Lengvesnė priežiūra']
  // },
  {
    title: 'Kvapo šalinimas',
    shortDescription: 'Nemalonių kvapų sumažinimas salone',
    fullDescription:
      'Naudojamos specialios priemonės, padedančios sumažinti ar pašalinti nemalonius kvapus salone ir suteikti gaivesnį pojūtį.',
    price: 'nuo 20 €',
    includes: ['Salono gaivinimas', 'Kvapų mažinimas', 'Švaresnis pojūtis']
  },
  {
    title: 'Variklio skyriaus valymas',
    shortDescription: 'Tvarkingas ir saugus variklio skyriaus sutvarkymas',
    fullDescription:
      'Atsargus variklio skyriaus valymas naudojant tam pritaikytas priemones. Tikslas yra pašalinti dulkes, purvą ir suteikti tvarkingesnę bendrą išvaizdą.',
    price: 'nuo 30 €',
    includes: ['Saugus valymas', 'Plastikų atgaivinimas', 'Tvarkingas vaizdas']
  },
  {
  title: "Bitumo ir kelio nešvarumų šalinimas",
  shortDescription: "Sunkiai pašalinamų kelio nešvarumų valymas nuo kėbulo.",
  fullDescription:
    "Naudojamos specialios cheminės priemonės bitumo, dervų, druskų ir kitų įsisenėjusių kelio nešvarumų pašalinimui nuo kėbulo paviršiaus. Padeda atkurti švaresnę ir lygesnę automobilio išvaizdą prieš tolimesnes priežiūros procedūras.",
  price: "nuo 60 €",
  includes: [
    "Bitumo dėmių šalinimas",
    "Kelio nešvarumų valymas",
    "Kėbulo paviršiaus paruošimas"
  ]
}
];

selectedServiceInfo: SelectedWebsiteServiceInfo | null = null;

toggleWebsiteServiceInfo(type: 'package' | 'single', index: number, event?: Event): void {
  event?.stopPropagation();

  if (
    this.selectedServiceInfo &&
    this.selectedServiceInfo.type === type &&
    this.selectedServiceInfo.index === index
  ) {
    this.selectedServiceInfo = null;
    return;
  }

  this.selectedServiceInfo = { type, index };
}

closeWebsiteServiceInfo(): void {
  this.selectedServiceInfo = null;
}
  reviews: ReviewItem[] = [
    {
      name: 'Sophia',
      stars: 5,
      text: 'The whole process was smooth and professional. The app feels premium and works exactly how we wanted.'
    },
    {
      name: 'Daniel',
      stars: 5,
      text: 'Very responsive team, beautiful design, and everything feels fast and polished. Our clients noticed the difference immediately.'
    },
    {
      name: 'Emma',
      stars: 4,
      text: 'Clean user experience, easy ordering flow, and great support during setup. It really helped our business look more modern.'
    },
    {
      name: 'Lucas',
      stars: 5,
      text: 'We wanted something better than the usual template-based solutions, and this delivered exactly that.'
    }
  ];

  duplicatedReviews: ReviewItem[] = [];
  currentReviewIndex = 1;

  private reviewsAutoplayInterval: ReturnType<typeof setInterval> | null = null;
  private readonly reviewAutoplayDelay = 4500;
  private isReviewAnimating = false;

  ngOnInit(): void {
    this.setupReviewsSlider();
    this.startReviewsAutoplay();
  }

  ngOnDestroy(): void {
    this.stopReviewsAutoplay();
  }

  private setupReviewsSlider(): void {
    if (!this.reviews.length) {
      this.duplicatedReviews = [];
      this.currentReviewIndex = 0;
      return;
    }

    const first = this.reviews[0];
    const last = this.reviews[this.reviews.length - 1];

    this.duplicatedReviews = [last, ...this.reviews, first];
    this.currentReviewIndex = 1;
  }

  nextReview(): void {
    if (this.isReviewAnimating || this.reviews.length <= 1) return;

    this.isReviewAnimating = true;
    this.currentReviewIndex++;

    setTimeout(() => {
      if (this.currentReviewIndex === this.duplicatedReviews.length - 1) {
        this.currentReviewIndex = 1;
      }
      this.isReviewAnimating = false;
    }, 500);
  }

  prevReview(): void {
    if (this.isReviewAnimating || this.reviews.length <= 1) return;

    this.isReviewAnimating = true;
    this.currentReviewIndex--;

    setTimeout(() => {
      if (this.currentReviewIndex === 0) {
        this.currentReviewIndex = this.reviews.length;
      }
      this.isReviewAnimating = false;
    }, 500);
  }

  goToReview(index: number): void {
    if (this.isReviewAnimating || this.reviews.length <= 1) return;

    this.currentReviewIndex = index + 1;
  }

  getActiveDotIndex(): number {
    if (!this.reviews.length) return 0;

    if (this.currentReviewIndex === 0) {
      return this.reviews.length - 1;
    }

    if (this.currentReviewIndex === this.duplicatedReviews.length - 1) {
      return 0;
    }

    return this.currentReviewIndex - 1;
  }

  getStars(count: number): boolean[] {
    return Array.from({ length: 5 }, (_, i) => i < count);
  }

  pauseReviewsAutoplay(): void {
    this.stopReviewsAutoplay();
  }

  resumeReviewsAutoplay(): void {
    this.startReviewsAutoplay();
  }

  private startReviewsAutoplay(): void {
    this.stopReviewsAutoplay();

    if (this.reviews.length <= 1) return;

    this.reviewsAutoplayInterval = setInterval(() => {
      this.nextReview();
    }, this.reviewAutoplayDelay);
  }

  private stopReviewsAutoplay(): void {
    if (this.reviewsAutoplayInterval) {
      clearInterval(this.reviewsAutoplayInterval);
      this.reviewsAutoplayInterval = null;
    }
  }
  openedPackage: BundleItem | null = null;

  openPackageInfo(pkg: BundleItem, event: Event) {
    event.stopPropagation();
    this.openedPackage = pkg;
  }
  private availabilityService = inject(AvailabilityService);
  private busySlotsService = inject(BusySlotsService);
  busySlots: BusySlot[] = [];
  selectedDateKey: string | null = null;



  formatDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  timeStringToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  minutesToTimeString(totalMinutes: number): string {
    const hours = Math.floor(totalMinutes / 60)
      .toString()
      .padStart(2, '0');
    const minutes = (totalMinutes % 60)
      .toString()
      .padStart(2, '0');

    return `${hours}:${minutes}`;
  }

  isTimeRangeOverlapping(
    startA: number,
    endA: number,
    startB: number,
    endB: number
  ): boolean {
    return startA < endB && endA > startB;
  }

  private firestore = inject(Firestore);
  isSubmittingReservation = false;
  reservationSubmitted = false;
  createdReservationId: string | null = null;
  submittedReservationSummary: any = null;
  reservationStep = 1; // 1 = services/packages, 2 = calendar, 3 = details

  customerFirstName = '';
  customerLastName = '';
  customerCountryCode = '+370';
  customerPhone = '';
  customerEmail = '';
  discountCode = '';
  paymentMethod = 'moketi_atvykus';
  selectedAddress = 'Pavilnės g. 5a, Vilnius';
  addressOptions: string[] = ['Pavilnės g. 5a, Vilnius'];

  allowPromoFilming = false;
  countryCodes: string[] = ['+370', '+371', '+372', '+48', '+49', '+31', '+44'];


  generateOrderNumber(): string {
    const now = new Date();

    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');

    const randomPart = Math.floor(100 + Math.random() * 900); // 100–999

    return `${datePart}-${randomPart}`;
  }
get isDetailsStepValid(): boolean {
  const hasTransportAddress =
    this.deliveryMode === 'self'
      ? true
      : !!this.pickupAddress.trim() &&
        (!this.returnToDifferentAddress || !!this.returnAddress.trim());

  const hasTimeSelection =
    this.deliveryMode === 'self'
      ? !!this.selectedDate && !!this.selectedTime
      : !!this.selectedPickupSlot && !!this.selectedReturnSlot;

  const hasServiceAddress =
    this.deliveryMode === 'self'
      ? !!this.selectedAddress.trim()
      : true;

  return !!(
    this.customerFirstName.trim() &&
    this.customerLastName.trim() &&
    this.customerCountryCode.trim() &&
    this.customerPhone.trim() &&
    this.customerEmail.trim() &&
    this.paymentMethod.trim() &&
    hasTimeSelection &&
    hasTransportAddress &&
    hasServiceAddress
  );
}
setDeliveryMode(mode: 'self' | 'pickup_return'): void {
  if (this.deliveryMode === mode) return;

  this.deliveryMode = mode;
  this.onDeliveryModeChange();
}
 async submitReservation() {
  if (!this.isDetailsStepValid || this.isSubmittingReservation) return;

  this.isSubmittingReservation = true;

  try {
    const orderNumber = this.generateOrderNumber();
    const isPickupReturn = this.deliveryMode === 'pickup_return';

    let dateKey: string | null = null;
    let bookingDate: Date | null = null;

    let bookingStartMinutes: number | null = null;
    let bookingEndMinutes: number | null = null;

    let pickupSlot: TransferSlotOption | null = null;
    let returnSlot: TransferSlotOption | null = null;
    let washWindow: { startMinutes: number; endMinutes: number } | null = null;

    if (isPickupReturn) {
      pickupSlot = this.selectedPickupSlot;
      returnSlot = this.selectedReturnSlot;

      if (!pickupSlot || !returnSlot) {
        alert('Pasirinkite paėmimo ir grąžinimo laiką.');
        return;
      }

      // MVP: пока поддерживаем только один день
      if (pickupSlot.dateKey !== returnSlot.dateKey) {
        alert('Šiuo metu paėmimas ir grąžinimas turi būti tą pačią dieną.');
        return;
      }

      dateKey = pickupSlot.dateKey;
      bookingDate = pickupSlot.date;

      const sameDayBusySlots = await new Promise<BusySlot[]>((resolve) => {
        this.busySlotsService
          .getBusySlotsByDate(dateKey!)
          .pipe(take(1))
          .subscribe(data => resolve(data));
      });

      const activeBusySlots = sameDayBusySlots.filter(
        slot => slot.status !== 'cancelled' && slot.status !== 'canceled'
      );

      // временно подменяем busySlots, чтобы findWashWindowBetween работал на свежих данных
      this.busySlots = activeBusySlots;

      // проверка, что pickup и return сами по себе не конфликтуют
      const pickupConflict = activeBusySlots.some(existingSlot =>
        this.isTimeRangeOverlapping(
          pickupSlot!.startMinutes,
          pickupSlot!.endMinutes,
          existingSlot.startMinutes,
          existingSlot.endMinutes
        )
      );

      const returnConflict = activeBusySlots.some(existingSlot =>
        this.isTimeRangeOverlapping(
          returnSlot!.startMinutes,
          returnSlot!.endMinutes,
          existingSlot.startMinutes,
          existingSlot.endMinutes
        )
      );

      if (pickupConflict || returnConflict) {
        alert('Pasirinktas paėmimo arba grąžinimo laikas jau užimtas.');
        return;
      }

      washWindow = this.findWashWindowBetween(pickupSlot, returnSlot);

      if (!washWindow) {
        alert('Tarp paėmimo ir grąžinimo nėra pakankamai laiko automobilio plovimui.');
        return;
      }

      bookingStartMinutes = washWindow.startMinutes;
      bookingEndMinutes = washWindow.endMinutes;

      // дополнительная защита: вдруг мойка конфликтует
      const washConflict = activeBusySlots.some(existingSlot =>
        this.isTimeRangeOverlapping(
          bookingStartMinutes!,
          bookingEndMinutes!,
          existingSlot.startMinutes,
          existingSlot.endMinutes
        )
      );

      if (washConflict) {
        alert('Tarp paėmimo ir grąžinimo nebeliko laisvo lango plovimui. Pasirinkite kitą laiką.');
        return;
      }
    } else {
      if (!this.selectedDate) {
        alert('Pasirinkite datą.');
        return;
      }

      dateKey = this.formatDateKey(this.selectedDate);
      bookingDate = this.selectedDate;

      bookingStartMinutes = this.getSelectedStartMinutes();
      bookingEndMinutes = this.getSelectedEndMinutes();

      if (bookingStartMinutes === null || bookingEndMinutes === null) {
        alert('Neteisingi rezervacijos duomenys.');
        return;
      }

      const sameDayBusySlots = await new Promise<BusySlot[]>((resolve) => {
        this.busySlotsService
          .getBusySlotsByDate(dateKey!)
          .pipe(take(1))
          .subscribe(data => resolve(data));
      });

      const hasConflict = sameDayBusySlots.some(existingSlot => {
        if (existingSlot.status === 'cancelled' || existingSlot.status === 'canceled') {
          return false;
        }

        return this.isTimeRangeOverlapping(
          bookingStartMinutes!,
          bookingEndMinutes!,
          existingSlot.startMinutes,
          existingSlot.endMinutes
        );
      });

      if (hasConflict) {
        alert('Pasirinktas laikas jau užimtas. Prašome pasirinkti kitą laiką.');

        if (this.selectedDate) {
          this.selectDate(this.selectedDate);
        }

        return;
      }
    }

    if (!dateKey || !bookingDate || bookingStartMinutes === null || bookingEndMinutes === null) {
      alert('Neteisingi rezervacijos duomenys.');
      return;
    }

    const reservationPayload = {
      orderNumber,
      status: 'new',
      createdAt: serverTimestamp(),

      customer: {
        firstName: this.customerFirstName.trim(),
        lastName: this.customerLastName.trim(),
        phone: this.fullPhoneNumber,
        email: this.customerEmail.trim()
      },

      address: this.selectedAddress,
      discountCode: this.discountCode.trim() || null,
      paymentMethod: this.paymentMethod,
      allowPromoFilming: this.allowPromoFilming,

      delivery: {
  mode: this.deliveryMode,
  pickupAddress: isPickupReturn ? this.pickupAddress.trim() : null,
returnAddress: isPickupReturn ? this.effectiveReturnAddress : null,
returnToDifferentAddress: isPickupReturn ? this.returnToDifferentAddress : null,

  pickupDateKey: isPickupReturn ? pickupSlot!.dateKey : null,
  pickupStartMinutes: isPickupReturn ? pickupSlot!.startMinutes : null,
  pickupEndMinutes: isPickupReturn ? pickupSlot!.endMinutes : null,

  returnDateKey: isPickupReturn ? returnSlot!.dateKey : null,
  returnStartMinutes: isPickupReturn ? returnSlot!.startMinutes : null,
  returnEndMinutes: isPickupReturn ? returnSlot!.endMinutes : null,

  pickup: isPickupReturn ? {
    date: pickupSlot!.date.toISOString(),
    dateKey: pickupSlot!.dateKey,
    startMinutes: pickupSlot!.startMinutes,
    endMinutes: pickupSlot!.endMinutes,
    label: pickupSlot!.label
  } : null,

  return: isPickupReturn ? {
    date: returnSlot!.date.toISOString(),
    dateKey: returnSlot!.dateKey,
    startMinutes: returnSlot!.startMinutes,
    endMinutes: returnSlot!.endMinutes,
    label: returnSlot!.label
  } : null
},

      booking: {
        date: bookingDate.toISOString(),
        dateKey,
        dateLabel: bookingDate.toLocaleDateString('lt-LT', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        time: isPickupReturn
          ? this.minutesToTimeString(bookingStartMinutes)
          : this.selectedTime,
        startMinutes: bookingStartMinutes,
        endMinutes: bookingEndMinutes,
        durationMin: this.totalDurationMin
      },

      selection: {
        packageId: this.selectedPackage?.id || null,
        packageTitle: this.selectedPackage?.title || null,
        packagePrice: this.selectedPackage?.price || null,
        services: this.selectedServiceItems.map(service => ({
          id: service.id,
          title: service.title,
          price: service.price,
          durationMin: service.durationMin
        }))
      },

      totals: {
        amount: this.totalPrice,
        currency: 'EUR'
      }
    };

    const batch = writeBatch(this.firestore);
    const reservationRef = doc(collection(this.firestore, 'reservations'));

    batch.set(reservationRef, reservationPayload);

    if (isPickupReturn) {
  const busySlotPickupRef = doc(collection(this.firestore, `busySlots/${dateKey}/slots`));
  const busySlotWashRef = doc(collection(this.firestore, `busySlots/${dateKey}/slots`));
  const busySlotReturnRef = doc(collection(this.firestore, `busySlots/${dateKey}/slots`));

  batch.set(busySlotPickupRef, {
    type: 'pickup',
    startMinutes: pickupSlot!.startMinutes,
    endMinutes: pickupSlot!.endMinutes,
    durationMin: 60,
    reservationId: reservationRef.id,
    status: 'active',
    createdAt: serverTimestamp()
  });

  batch.set(busySlotWashRef, {
    type: 'wash',
    startMinutes: washWindow!.startMinutes,
    endMinutes: washWindow!.endMinutes,
    durationMin: this.totalDurationMin,
    reservationId: reservationRef.id,
    status: 'active',
    createdAt: serverTimestamp()
  });

  batch.set(busySlotReturnRef, {
    type: 'return',
    startMinutes: returnSlot!.startMinutes,
    endMinutes: returnSlot!.endMinutes,
    durationMin: 60,
    reservationId: reservationRef.id,
    status: 'active',
    createdAt: serverTimestamp()
  });

  const pickupTaskRef = doc(collection(this.firestore, 'pickupsDropoffs'));
  const returnTaskRef = doc(collection(this.firestore, 'pickupsDropoffs'));

  batch.set(pickupTaskRef, {
  type: 'pickup',
  reservationId: reservationRef.id,
  orderNumber,
  status: 'new',
  createdAt: serverTimestamp(),

  date: pickupSlot!.date.toISOString(),
  dateKey: pickupSlot!.dateKey,
  startMinutes: pickupSlot!.startMinutes,
  endMinutes: pickupSlot!.endMinutes,
  label: pickupSlot!.label,

  customer: {
    firstName: this.customerFirstName.trim(),
    lastName: this.customerLastName.trim(),
    phone: this.fullPhoneNumber,
    email: this.customerEmail.trim()
  },

  pickupAddress: this.pickupAddress.trim(),
  returnAddress: this.effectiveReturnAddress,
  vehicleAddress: this.pickupAddress.trim(),
  serviceAddress: null,

  selection: {
    packageId: this.selectedPackage?.id || null,
    packageTitle: this.selectedPackage?.title || null,
    packagePrice: this.selectedPackage?.price || null,
    services: this.selectedServiceItems.map(service => ({
      id: service.id,
      title: service.title,
      price: service.price,
      durationMin: service.durationMin
    }))
  },

  paymentMethod: this.paymentMethod,
  allowPromoFilming: this.allowPromoFilming
});

  batch.set(returnTaskRef, {
  type: 'return',
  reservationId: reservationRef.id,
  orderNumber,
  status: 'new',
  createdAt: serverTimestamp(),

  date: returnSlot!.date.toISOString(),
  dateKey: returnSlot!.dateKey,
  startMinutes: returnSlot!.startMinutes,
  endMinutes: returnSlot!.endMinutes,
  label: returnSlot!.label,

  customer: {
    firstName: this.customerFirstName.trim(),
    lastName: this.customerLastName.trim(),
    phone: this.fullPhoneNumber,
    email: this.customerEmail.trim()
  },

  pickupAddress: this.pickupAddress.trim(),
  returnAddress: this.effectiveReturnAddress,
  vehicleAddress: this.effectiveReturnAddress,
  serviceAddress: null,

  selection: {
    packageId: this.selectedPackage?.id || null,
    packageTitle: this.selectedPackage?.title || null,
    packagePrice: this.selectedPackage?.price || null,
    services: this.selectedServiceItems.map(service => ({
      id: service.id,
      title: service.title,
      price: service.price,
      durationMin: service.durationMin
    }))
  },

  paymentMethod: this.paymentMethod,
  allowPromoFilming: this.allowPromoFilming
});
} else {
  const busySlotRef = doc(collection(this.firestore, `busySlots/${dateKey}/slots`));

  batch.set(busySlotRef, {
    type: 'wash',
    startMinutes: bookingStartMinutes,
    endMinutes: bookingEndMinutes,
    time: this.selectedTime,
    durationMin: this.totalDurationMin,
    reservationId: reservationRef.id,
    status: 'active',
    createdAt: serverTimestamp()
  });
}

    await batch.commit();

    this.createdReservationId = reservationRef.id;
    this.reservationSubmitted = true;
    this.reservationStep = 4;

    this.submittedReservationSummary = {
  id: reservationRef.id,
  orderNumber,
  firstName: this.customerFirstName.trim(),
  lastName: this.customerLastName.trim(),
  phone: this.fullPhoneNumber,
  email: this.customerEmail.trim(),
  address: this.selectedAddress,

  deliveryMode: this.deliveryMode,
  pickupAddress: isPickupReturn ? this.pickupAddress.trim() : null,
  returnAddress: isPickupReturn ? this.effectiveReturnAddress : null,

  pickup: isPickupReturn ? {
    date: pickupSlot!.date.toISOString(),
    dateKey: pickupSlot!.dateKey,
    startMinutes: pickupSlot!.startMinutes,
    endMinutes: pickupSlot!.endMinutes,
    label: pickupSlot!.label
  } : null,

  wash: isPickupReturn ? {
    startMinutes: washWindow!.startMinutes,
    endMinutes: washWindow!.endMinutes,
    label: `${this.minutesToTimeString(washWindow!.startMinutes)}–${this.minutesToTimeString(washWindow!.endMinutes)}`
  } : null,

  return: isPickupReturn ? {
    date: returnSlot!.date.toISOString(),
    dateKey: returnSlot!.dateKey,
    startMinutes: returnSlot!.startMinutes,
    endMinutes: returnSlot!.endMinutes,
    label: returnSlot!.label
  } : null,

  pickupLabel: isPickupReturn ? pickupSlot!.label : null,
  washLabel: isPickupReturn
    ? `${this.minutesToTimeString(washWindow!.startMinutes)}–${this.minutesToTimeString(washWindow!.endMinutes)}`
    : null,
  returnLabel: isPickupReturn ? returnSlot!.label : null,

  discountCode: this.discountCode.trim(),
  paymentMethod: this.paymentMethod,
  allowPromoFilming: this.allowPromoFilming,
  dateLabel: bookingDate.toLocaleDateString('lt-LT', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }),
  time: isPickupReturn
    ? this.minutesToTimeString(bookingStartMinutes)
    : this.selectedTime,
  duration: this.formattedDuration,
  totalPrice: this.totalPrice,
  packageTitle: this.selectedPackage?.title || null,
  packagePrice: this.selectedPackage?.price || null,
  services: this.selectedServiceItems.map(service => ({
    title: service.title,
    price: service.price
  }))
};
  } catch (error) {
    console.error('Failed to submit reservation:', error);
    alert('Nepavyko išsaugoti rezervacijos. Bandykite dar kartą.');
  } finally {
    this.isSubmittingReservation = false;
  }
}
  resetReservationFlow() {
    this.selectedPackageId = null;
    this.selectedServices = [];
    this.calendarOpen = false;
    this.selectedDate = null;
    this.selectedTime = null;
    this.timeSlots = [];

    this.customerFirstName = '';
    this.customerLastName = '';
    this.customerCountryCode = '+370';
    this.customerPhone = '';
    this.customerEmail = '';
    this.discountCode = '';
    this.paymentMethod = 'moketi_atvykus';
    this.selectedAddress = 'Pavilnės g. 5a, Vilnius';
    this.allowPromoFilming = false;

    this.reservationSubmitted = false;
    this.createdReservationId = null;
    this.submittedReservationSummary = null;
    this.reservationStep = 1;
  }
  get fullPhoneNumber(): string {
    return `${this.customerCountryCode} ${this.customerPhone}`.trim();
  }
  goToCalendar() {
    if (!this.selectedPackageId && this.selectedServices.length === 0) return;

    this.calendarOpen = true;
    this.reservationStep = 2;
    this.generateCalendarDays();
  }

  goToDetailsStep() {
  const hasTimeSelection =
    this.deliveryMode === 'self'
      ? !!this.selectedDate && !!this.selectedTime
      : !!this.selectedPickupSlot && !!this.selectedReturnSlot;

  if (!hasTimeSelection) return;

  this.reservationStep = 3;
}

  backToSelection() {
  this.reservationStep = 1;
  this.calendarOpen = false;

  this.selectedDate = null;
  this.selectedTime = null;
  this.timeSlots = [];
  this.selectedDateKey = null;

  this.resetPickupReturnCalendarState();
}

  backToCalendar() {
    this.reservationStep = 2;
    this.calendarOpen = true;
  }
 private resetPickupReturnCalendarState(): void {
  this.pickupReturnStep = 'pickup';

  this.pickupSlots = [];
  this.returnSlots = [];

  this.selectedPickupDate = null;
  this.selectedPickupSlot = null;

  this.selectedReturnDate = null;
  this.selectedReturnSlot = null;
}

openCalendar() {
  if (!this.selectedPackageId && this.selectedServices.length === 0) return;

  this.selectedDate = null;
  this.selectedTime = null;
  this.timeSlots = [];
  this.selectedDateKey = null;

  this.resetPickupReturnCalendarState();

  this.calendarOpen = true;
  this.reservationStep = 2;
  this.generateCalendarDays();
}
  get selectedPackage(): BundleItem | null {
    if (!this.selectedPackageId) return null;
    return this.packages.find(p => p.id === this.selectedPackageId) || null;
  }

  get selectedServiceItems(): ServiceItem[] {
    return this.services.filter(service => this.selectedServices.includes(service.id));
  }

  get packageSubtotal(): number {
    return this.selectedPackage?.price || 0;
  }

  get additionalServicesSubtotal(): number {
    return this.selectedServiceItems.reduce((sum, service) => sum + (service.price || 0), 0);
  }

  get servicesSubtotal(): number {
    return this.packageSubtotal + this.additionalServicesSubtotal;
  }

get pickupReturnFee(): number {
  if (this.deliveryMode !== 'pickup_return') return 0;
  return this.servicesSubtotal >= 50 ? 0 : 20;
}

get totalPrice(): number {
  return this.servicesSubtotal + this.pickupReturnFee;
}
  get hasPaidPickupReturn(): boolean {
  return this.deliveryMode === 'pickup_return' && this.pickupReturnFee > 0;
}

get isPickupReturnFree(): boolean {
  return this.deliveryMode === 'pickup_return' && this.pickupReturnFee === 0;
}

  get formattedSelectedDate(): string {
    if (!this.selectedDate) return '';
    return this.selectedDate.toLocaleDateString('lt-LT', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
  closeCalendar() {
    this.calendarOpen = false;
    this.reservationStep = 1;
    this.selectedDate = null;
    this.selectedTime = null;
    this.timeSlots = [];
  }
  private resetCalendarSelection(): void {
  this.selectedDate = null;
  this.selectedTime = null;
  this.timeSlots = [];
  this.selectedDateKey = null;
}
  isBeforeTomorrow(day: Date): boolean {
    const candidate = new Date(day);
    candidate.setHours(0, 0, 0, 0);

    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return candidate < tomorrow;
  }

  canSelectDay(day: Date): boolean {
    return this.hasAvailability(day) && !this.isBeforeTomorrow(day);
  }
  generateCalendarDays() {
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const startWeekday = (firstDayOfMonth.getDay() + 6) % 7; // Monday first
    const gridStart = new Date(year, month, 1 - startWeekday);

    this.calendarDays = [];

    for (let i = 0; i < 42; i++) {
      const day = new Date(gridStart);
      day.setDate(gridStart.getDate() + i);
      this.calendarDays.push(day);
    }
  }
  goToNextStep() {
    console.log('Selected date:', this.selectedDate);
    console.log('Selected time:', this.selectedTime);
  }
  previousMonth() {
    this.currentMonth = new Date(
      this.currentMonth.getFullYear(),
      this.currentMonth.getMonth() - 1,
      1
    );
    this.selectedDate = null;
    this.selectedTime = null;
    this.timeSlots = [];
    this.generateCalendarDays();
  }

  nextMonth() {
    this.currentMonth = new Date(
      this.currentMonth.getFullYear(),
      this.currentMonth.getMonth() + 1,
      1
    );
    this.selectedDate = null;
    this.selectedTime = null;
    this.timeSlots = [];
    this.generateCalendarDays();
  }

  isSameDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  hasAvailability(day: Date): boolean {
    return this.availabilityItems.some(item => {
      const itemDate = this.toDate(item.date);
      return this.isSameDay(itemDate, day);
    });
  }

  isCurrentMonth(day: Date): boolean {
    return day.getMonth() === this.currentMonth.getMonth();
  }

  isSelectedDay(day: Date): boolean {
    return this.selectedDate ? this.isSameDay(this.selectedDate, day) : false;
  }

selectDate(day: Date) {
  if (!this.canSelectDay(day)) return;

  this.selectedDate = day;
  this.selectedTime = null;

  const dateKey = this.formatDateKey(day);
  this.selectedDateKey = dateKey;

  this.busySlotsService
    .getBusySlotsByDate(dateKey)
    .pipe(take(1))
    .subscribe(data => {
      this.busySlots = data.filter(
        slot => slot.status !== 'cancelled' && slot.status !== 'canceled'
      );

      if (this.deliveryMode === 'pickup_return') {
  this.pickupSlots = this.generateTransferSlotsForDay(day);

  const allReturnSlots = this.generateTransferSlotsForDay(day);

  this.returnSlots = this.selectedPickupSlot
    ? allReturnSlots.filter(slot =>
        this.canFitWashBetweenPickupAndReturn(this.selectedPickupSlot!, slot)
      )
    : [];
} else {
  this.generateTimeSlotsForDay(day);
}
    });
}

  generateTimeSlotsForDay(day: Date) {
    const availability = this.availabilityItems.find(item => {
      const itemDate = this.toDate(item.date);
      return this.isSameDay(itemDate, day);
    });

    if (!availability) {
      this.timeSlots = [];
      return;
    }

    const start = this.toDate(availability.start);
    const end = this.toDate(availability.end);
    const durationMin = this.totalDurationMin;

    this.timeSlots = this.generateSlots(start, end, durationMin);
  }
  getSelectedStartMinutes(): number | null {
    if (!this.selectedTime) return null;
    return this.timeStringToMinutes(this.selectedTime);
  }

  getSelectedEndMinutes(): number | null {
    const start = this.getSelectedStartMinutes();
    if (start === null) return null;
    return start + this.totalDurationMin;
  }
  generateSlots(start: Date, end: Date, durationMin: number): string[] {
    const slots: string[] = [];
    const stepMin = 30;

    let current = this.roundUpToNextHalfHour(start);

    while (true) {
      const slotEnd = new Date(current.getTime() + durationMin * 60000);

      if (slotEnd > end) break;

      const slotStartMinutes = current.getHours() * 60 + current.getMinutes();
      const slotEndMinutes = slotStartMinutes + durationMin;

      const hasConflict = this.busySlots.some(slot => {
        if (slot.status === 'cancelled' || slot.status === 'canceled') {
          return false;
        }

        return this.isTimeRangeOverlapping(
          slotStartMinutes,
          slotEndMinutes,
          slot.startMinutes,
          slot.endMinutes
        );
      });

      if (!hasConflict) {
        slots.push(this.formatTime(current));
      }

      current = new Date(current.getTime() + stepMin * 60000);
    }


    return slots;
  }

  formatTime(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  selectTime(slot: string) {
    this.selectedTime = slot;
  }

  toDate(value: any): Date {
    if (!value) return new Date();

    if (value?.toDate) return value.toDate();

    return new Date(value);
  }

  get currentMonthLabel(): string {
    return this.currentMonth.toLocaleDateString('lt-LT', {
      month: 'long',
      year: 'numeric'
    });
  }

  get weekdayLabels(): string[] {
    return ['Pr', 'An', 'Tr', 'Kt', 'Pn', 'Št', 'Sk'];
  }
  calendarOpen = false;
  selectedDate: Date | null = null;
  selectedTime: string | null = null;

  currentMonth = new Date();
  calendarDays: Date[] = [];

  availabilityItems: AvailabilityItem[] = [];
  timeSlots: string[] = [];

  readonly bookingUserId = 'debug-user';
  closePackageInfo() {
    this.openedPackage = null;
  }
  get totalDurationMin(): number {
    const packageDuration = this.selectedPackage?.durationMin || this.selectedPackage?.duration || 0;
    const servicesDuration = this.selectedServices.reduce((total, id) => {
      const service = this.services.find(s => s.id === id);
      return total + (service?.durationMin || 0);
    }, 0);

    return packageDuration + servicesDuration;
  }

beforeAfterPosition = 50;

onBeforeAfterMove(event: MouseEvent): void {
  const container = event.currentTarget as HTMLElement;
  if (!container) return;

  const rect = container.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const percent = (x / rect.width) * 100;

  this.beforeAfterPosition = Math.max(0, Math.min(100, percent));
}

onBeforeAfterTouch(event: TouchEvent): void {
  const container = event.currentTarget as HTMLElement;
  if (!container || !event.touches.length) return;

  const rect = container.getBoundingClientRect();
  const x = event.touches[0].clientX - rect.left;
  const percent = (x / rect.width) * 100;

  this.beforeAfterPosition = Math.max(0, Math.min(100, percent));
}

  get formattedDuration(): string {
    const total = this.totalDurationMin;

    if (!total) return '';

    const hours = Math.floor(total / 60);
    const minutes = total % 60;

    if (hours === 0) {
      return `${minutes} min`;
    }

    if (minutes === 0) {
      return `${hours} val`;
    }

    return `${hours} val ${minutes} min`;
  }
  /* ===== MAGIC BLOCKS ===== */
  @ViewChildren('magic') magicBlocks!: QueryList<ElementRef>;
  private currentIndex = 0;
  showScrollHint = false;

  /* ===== HEADER ===== */
  headerHidden = false;
  private lastScrollY = 0;

  /* ===============================
     FAQ ACCORDION
  =============================== */

  faqItems = [
    {
      question: 'Kiek laiko trunka automobilio valymas?',
      answer:
        'Valymo trukmė priklauso nuo pasirinktų paslaugų ir automobilio būklės. Paprastas plovimas gali užtrukti apie 1–2 val., o pilnas detailingas – nuo 3 iki 8 val. Tiksli trukmė nurodoma rezervacijos metu.'
    },
    {
      question: 'Kas įeina į salono valymą?',
      answer:
        'Salono valymas apima siurbimą, paviršių nuvalymą, plastikų atnaujinimą, langų valymą. Giluminio valymo metu papildomai šalinamos dėmės ir gilesni nešvarumai.'
    },
    {
      question: 'Ar pašalinamos visos dėmės ir kvapai?',
      answer:
        'Daugumą dėmių ir kvapų galima ženkliai sumažinti arba visiškai pašalinti, tačiau tai priklauso nuo jų pobūdžio ir įsisenėjimo. Apie galutinį rezultatą informuojame prieš darbų pradžią.'
    },
    {
      question: 'Ar saugu mano automobilio dažams?',
      answer:
        'Taip. Naudojame profesionalias, saugias priemones ir metodus, kurie nepažeidžia dažų paviršiaus ir padeda išlaikyti jo būklę.'
    },
    {
      question: 'Ar reikia rezervuoti iš anksto?',
      answer:
        'Taip. :)'
    },
    {
      question: 'Ar galima atsiskaityti vietoje?',
      answer:
        'Taip, šiuo metu atsiskaitymas galimas atvykus (grynaisiais). Ateityje planuojame įdiegti ir kitus mokėjimo būdus.'
    },
    {
      question: 'Ar teikiate automobilio paėmimo ir grąžinimo paslaugą?',
      answer:
        'Taip, siūlome nemokamą automobilio paėmimą ir grąžinimą Vilniuje užsakymams nuo 50 €. Mažesniems užsakymams taikomas 20 € mokestis.'
    },
    {
      question: 'Ar galiu atšaukti ar pakeisti rezervaciją?',
      answer:
        'Taip, rezervaciją galite pakeisti arba atšaukti susisiekę su mumis iš anksto.'
    },
    {
      question: 'Ar teikiate automobilio paėmimo ir grąžinimo paslaugą?',
      answer:
        'Taip, siūlome nemokamą automobilio paėmimą ir grąžinimą Vilniuje užsakymams nuo 50 €. Mažesniems užsakymams taikomas 20 € mokestis.'
    },
    {
      question: 'Ar dirbate su visų tipų automobiliais?',
      answer:
        'Taip, dirbame su įvairių tipų automobiliais – nuo mažų miesto automobilių iki didesnių SUV.'
    },
    
  ];

  private reservationDataService = inject(ReservationDataService);

  packages: BundleItem[] = [];
  services: ServiceItem[] = [];

  selectedPackageId: string | null = null;
  selectedServices: string[] = [];

selectPackage(packageId: string) {
  this.selectedPackageId =
    this.selectedPackageId === packageId ? null : packageId;

  this.resetCalendarSelection();
}

selectService(serviceId: string) {
  const exists = this.selectedServices.includes(serviceId);

  if (exists) {
    this.selectedServices = this.selectedServices.filter(id => id !== serviceId);
  } else {
    this.selectedServices = [...this.selectedServices, serviceId];
  }

  this.resetCalendarSelection();
}

  isServiceSelected(serviceId: string): boolean {
    return this.selectedServices.includes(serviceId);
  }


  openFaqIndex: number | null = null;

  toggleFaq(index: number) {
    this.openFaqIndex = this.openFaqIndex === index ? null : index;
  }


  scrollToContact(event: Event) {
    event.preventDefault();

    const page = document.querySelector('.page') as HTMLElement;
    if (!page || !this.contactSection) return;

    const top =
      this.contactSection.nativeElement.offsetTop;

    page.scrollTo({
      top,
      behavior: 'smooth'
    });
  }
  scrollToTop() {
    const page = document.querySelector('.page') as HTMLElement;
    page?.scrollTo({ top: 0, behavior: 'smooth' });
  }
  private setBackgroundByIndex(index: number | null) {
    const page = document.querySelector('.page') as HTMLElement;
    if (!page) return;

    switch (index) {
      case 0:
        page.style.backgroundColor = '#E6F4EF'; // mint
        break;
      case 1:
        page.style.backgroundColor = '#EAF1FB'; // blue
        break;
      case 2:
        page.style.backgroundColor = '#FFF4E5'; // sand
        break;
      case 3:
        page.style.backgroundColor = '#F1ECFA'; // lavender
        break;
      default:
        page.style.backgroundColor = '#FFFFFF';
    }
  }
  roundUpToNextHalfHour(date: Date): Date {
    const rounded = new Date(date);
    rounded.setSeconds(0, 0);

    const minutes = rounded.getMinutes();

    if (minutes === 0 || minutes === 30) {
      return rounded;
    }

    if (minutes < 30) {
      rounded.setMinutes(30);
      return rounded;
    }

    rounded.setHours(rounded.getHours() + 1);
    rounded.setMinutes(0);
    return rounded;
  }

  ngAfterViewInit() {

    this.availabilityService.getAvailability(this.bookingUserId).subscribe(data => {
      this.availabilityItems = data;
      this.generateCalendarDays();
    });

    this.reservationDataService.getBundles().subscribe(data => {
      console.log('BUNDLES FROM DB:', data);
      this.packages = data;
    });

    this.reservationDataService.getServices().subscribe(data => {
      console.log('SERVICES FROM DB:', data);
      this.services = data;
    });
    /* ===============================
       MAGIC BLOCKS (page container)
    =============================== */

    const page = document.querySelector('.page') as HTMLElement;
    const blocks = this.magicBlocks.toArray();
    // 🔥 выставляем фон для первого блока при старте
    this.setBackgroundByIndex(0);

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;

          const el = entry.target as HTMLElement;
          const newIndex = blocks.findIndex(
            b => b.nativeElement === el
          );

          if (newIndex === -1 || newIndex === this.currentIndex) return;

          blocks[this.currentIndex].nativeElement.classList.remove('active');
          el.classList.add('active');

          this.currentIndex = newIndex;
          this.setBackgroundByIndex(newIndex);

        });
      },
      {
        root: page,
        threshold: 0.6
      }
    );

    blocks.forEach(b => observer.observe(b.nativeElement));
    page.addEventListener('scroll', () => {
      const lastMagic = this.magicBlocks.last?.nativeElement;
      if (!lastMagic) return;

      const lastMagicBottom =
        lastMagic.offsetTop + lastMagic.offsetHeight;

      if (page.scrollTop > lastMagicBottom - page.clientHeight / 2) {
        this.setBackgroundByIndex(null); // возвращаем белый
      }
    });

    /* ===============================
       FLOATING HEADER (WINDOW SCROLL)
    =============================== */

    /* ===============================
   FLOATING HEADER (PAGE SCROLL)
=============================== */


    page.addEventListener('scroll', () => {
      const current = page.scrollTop;

      // всегда виден в самом верху
      if (current < 40) {
        this.headerHidden = false;
        this.lastScrollY = current;
        return;
      }

      // анти-дёрганье
      if (Math.abs(current - this.lastScrollY) < 8) return;

      if (current > this.lastScrollY) {
        // ⬇️ скролл вниз
        this.headerHidden = true;
      } else {
        // ⬆️ скролл вверх
        this.headerHidden = false;
      }

      this.lastScrollY = current;
    });
    setTimeout(() => {
      this.showScrollHint = true;
    }, 1000);

  }
}
