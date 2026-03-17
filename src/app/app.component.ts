import {
  AfterViewInit,
  Component,
  ElementRef,
  QueryList,
  ViewChildren,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule], // 🔥 ВОТ ЭТО ГЛАВНОЕ
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements AfterViewInit {

@ViewChild('contact') contactSection!: ElementRef;

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
    question: 'What exactly do you offer?',
    answer:
      'We provide fully native, white-label mobile apps for individual businesses. Each client gets their own branded iOS and Android app, powered by a shared SaaS platform that we maintain and continuously improve.'
  },
  {
    question: 'How is this different from Wolt or Bolt Food?',
    answer:
      'Delivery platforms help you attract new customers, but they charge high commissions and own the relationship. We help you keep your customers by moving them into your own app, where you control pricing, branding, and communication.'
  },
  {
    question: 'Do I get my own app or a shared app?',
    answer:
      'You get your own separate app with your branding, logo, and identity. Your customers download your app — not a marketplace — while we handle the infrastructure behind the scenes.'
  },
  {
    question: 'How much does it cost?',
    answer:
      'There are no large upfront development costs. We work with a low commission model, making it affordable even for small and medium-sized businesses.'
  },
  {
    question: 'Do you support payments and delivery?',
    answer:
      'Yes. Your app can support takeaway, delivery (if your business handles it), online payments of your choice, loyalty systems, and push notifications.'
  },
  {
    question: 'Who maintains and updates the app?',
    answer:
      'We do. The app is continuously updated with improvements, new features, and platform updates. You don’t need to worry about App Store or Google Play changes.'
  },
  {
    question: 'Can features be customized for my business?',
    answer:
      'Yes. We actively work with our clients, listen to their needs, and can implement custom features or improvements when they make sense.'
  },
  {
    question: 'Is this suitable for small businesses?',
    answer:
      'Absolutely. Our platform is designed to be scalable and affordable, whether you run a single cafe or plan to grow further.'
  }
];

packages = [
  {
    id: 'pkg-1',
    name: 'Paketas 1',
    description: 'Paketo aprašymas'
  },
  {
    id: 'pkg-2',
    name: 'Paketas 2',
    description: 'Paketo aprašymas'
  },
  {
    id: 'pkg-3',
    name: 'Paketas 3',
    description: 'Paketo aprašymas'
  }
];

services = [
  { id: 'srv-1', name: 'Paslauga 1', price: '€0' },
  { id: 'srv-2', name: 'Paslauga 2', price: '€0' },
  { id: 'srv-3', name: 'Paslauga 3', price: '€0' },
  { id: 'srv-4', name: 'Paslauga 4', price: '€0' },
  { id: 'srv-5', name: 'Paslauga 5', price: '€0' }
];

selectedPackageId: string | null = null;
selectedServices: string[] = [];

selectPackage(packageId: string) {
  // если был выбран сервис — сбрасываем его
  this.selectedServices = [];

  this.selectedPackageId =
    this.selectedPackageId === packageId ? null : packageId;
}

selectService(serviceId: string) {
  // если был выбран пакет — сбрасываем его
  this.selectedPackageId = null;

  const exists = this.selectedServices.includes(serviceId);

  if (exists) {
    this.selectedServices =
      this.selectedServices.filter(id => id !== serviceId);
  } else {
    this.selectedServices = [...this.selectedServices, serviceId];
  }
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


  ngAfterViewInit() {

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
