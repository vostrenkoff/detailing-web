import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-gallery-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="gallery-page">
      <div class="gallery-page__glow gallery-page__glow--left"></div>
      <div class="gallery-page__glow gallery-page__glow--right"></div>

      <div class="gallery-page__inner">
        <a routerLink="/" class="gallery-page__back">Atgal i pagrindini puslapi</a>

        <div class="gallery-page__content">
          <div class="gallery-page__copy">
            <div class="gallery-page__eyebrow">Galerija</div>
            <h1 class="gallery-page__title">Musu atliktu darbu galerija</h1>
            <p class="gallery-page__text">
              Galerija kol kas tuscia, bet netrukus cia papildysime nuotraukomis
              is musu atliktu darbu, kad galetumet aiskiai pamatyti rezultatus.
            </p>

            <div class="gallery-page__actions">
              <a routerLink="/" class="gallery-page__button">Grizti i pradzia</a>
            </div>
          </div>

          <!-- <div class="gallery-page__card">
            <div class="gallery-page__card-badge">Greitai papildysime</div>
            <div class="gallery-page__card-frame">
              <div class="gallery-page__placeholder">
                <div class="gallery-page__placeholder-icon">+</div>
                <div class="gallery-page__placeholder-title">Nuotraukos jau ruošiamos</div>
                <div class="gallery-page__placeholder-text">
                  Cia atsiras realus musu darbu pavyzdziai: pries ir po rezultatai,
                  salono valymas, kebulo prieziura ir daugiau.
                </div>
              </div>
            </div>
          </div> -->
        </div>
      </div>
    </section>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background:
        radial-gradient(circle at top left, rgba(255, 77, 79, 0.14), transparent 28%),
        radial-gradient(circle at bottom right, rgba(255, 255, 255, 0.08), transparent 22%),
        linear-gradient(180deg, #0a0a0a 0%, #050505 100%);
      color: #fff;
    }

    .gallery-page {
      position: relative;
      min-height: 100vh;
      overflow: hidden;
      padding: 32px 24px 48px;
    }

    .gallery-page__glow {
      position: absolute;
      border-radius: 999px;
      filter: blur(60px);
      opacity: 0.45;
      pointer-events: none;
    }

    .gallery-page__glow--left {
      top: 80px;
      left: -80px;
      width: 240px;
      height: 240px;
      background: rgba(255, 77, 79, 0.28);
    }

    .gallery-page__glow--right {
      right: -60px;
      bottom: 80px;
      width: 220px;
      height: 220px;
      background: rgba(255, 255, 255, 0.08);
    }

    .gallery-page__inner {
      position: relative;
      z-index: 1;
      max-width: 1240px;
      margin: 0 auto;
    }

    .gallery-page__back {
      display: inline-flex;
      align-items: center;
      min-height: 48px;
      padding: 0 18px;
      margin-bottom: 40px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      background: rgba(255, 255, 255, 0.04);
      color: rgba(255, 255, 255, 0.9);
      text-decoration: none;
      font-size: 14px;
      font-weight: 700;
      transition: background 0.2s ease, transform 0.2s ease;
      backdrop-filter: blur(10px);
    }

    .gallery-page__back:hover {
      background: rgba(255, 255, 255, 0.08);
      transform: translateY(-1px);
    }

    .gallery-page__content {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(320px, 460px);
      gap: 32px;
      align-items: center;
    }

    .gallery-page__copy {
      max-width: 680px;
    }

    .gallery-page__eyebrow {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 10px 16px;
      margin-bottom: 22px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: rgba(255, 255, 255, 0.78);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .gallery-page__title {
      margin: 0 0 18px;
      font-size: clamp(38px, 7vw, 76px);
      line-height: 0.98;
      letter-spacing: -0.05em;
      font-weight: 700;
    }

    .gallery-page__text {
      margin: 0;
      max-width: 620px;
      color: rgba(255, 255, 255, 0.64);
      font-size: 18px;
      line-height: 1.75;
    }

    .gallery-page__actions {
      margin-top: 32px;
    }

    .gallery-page__button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 56px;
      padding: 0 26px;
      border-radius: 999px;
      background: #ff4d4f;
      color: #fff;
      text-decoration: none;
      font-size: 16px;
      font-weight: 700;
      letter-spacing: -0.01em;
      box-shadow: 0 16px 40px rgba(255, 77, 79, 0.24);
      transition: transform 0.2s ease, opacity 0.2s ease, box-shadow 0.2s ease;
    }

    .gallery-page__button:hover {
      transform: translateY(-2px);
      opacity: 0.96;
      box-shadow: 0 20px 46px rgba(255, 77, 79, 0.32);
    }

    .gallery-page__card {
      position: relative;
      padding: 22px;
      border-radius: 30px;
      background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03));
      border: 1px solid rgba(255,255,255,0.08);
      box-shadow:
        0 24px 70px rgba(0,0,0,0.48),
        inset 0 1px 0 rgba(255,255,255,0.04);
    }

    .gallery-page__card-badge {
      display: inline-flex;
      align-items: center;
      min-height: 40px;
      padding: 0 14px;
      margin-bottom: 18px;
      border-radius: 999px;
      background: rgba(255, 77, 79, 0.14);
      color: #ff8f90;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .gallery-page__card-frame {
      aspect-ratio: 4 / 5;
      border-radius: 24px;
      overflow: hidden;
      background:
        linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015)),
        repeating-linear-gradient(
          -45deg,
          rgba(255,255,255,0.02) 0,
          rgba(255,255,255,0.02) 16px,
          rgba(255,255,255,0.035) 16px,
          rgba(255,255,255,0.035) 32px
        );
      border: 1px solid rgba(255,255,255,0.08);
    }

    .gallery-page__placeholder {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: flex-end;
      gap: 14px;
      height: 100%;
      padding: 28px;
      background:
        linear-gradient(180deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.34) 100%);
    }

    .gallery-page__placeholder-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 58px;
      height: 58px;
      border-radius: 18px;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.12);
      color: #ff8f90;
      font-size: 28px;
      font-weight: 700;
    }

    .gallery-page__placeholder-title {
      font-size: 24px;
      line-height: 1.15;
      font-weight: 700;
      letter-spacing: -0.03em;
    }

    .gallery-page__placeholder-text {
      color: rgba(255,255,255,0.64);
      font-size: 15px;
      line-height: 1.7;
    }

    @media (max-width: 980px) {
      .gallery-page {
        padding-top: 24px;
      }

      .gallery-page__content {
        grid-template-columns: 1fr;
      }

      .gallery-page__copy {
        max-width: none;
      }

      .gallery-page__card {
        max-width: 520px;
      }
    }

    @media (max-width: 640px) {
      .gallery-page {
        padding: 20px 16px 36px;
      }

      .gallery-page__back {
        margin-bottom: 28px;
      }

      .gallery-page__text {
        font-size: 16px;
      }

      .gallery-page__card {
        padding: 16px;
        border-radius: 24px;
      }

      .gallery-page__placeholder {
        padding: 22px;
      }
    }
  `]
})
export class GalleryPageComponent {}
