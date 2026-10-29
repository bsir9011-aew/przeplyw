# PRZEPŁYW · First Interactive Network Lab

Mobilne laboratorium: przewidź → uruchom → prześledź decyzje → zmień kolejność ACL → sprawdź ponownie.

## Uruchomienie

Node 22.12+ lub 24 LTS oraz npm.

```sh
npm ci
npm run dev
```

Otwórz adres wyświetlony przez Vite. Telefon w tej samej sieci może użyć adresu komputera i portu 5173. W Codespaces przekieruj port 5173. Build: `npm run build`, podgląd: `npx vite preview --host 0.0.0.0`.

## Ćwiczenie

1. Dotknij urządzeń, aby obejrzeć konfigurację.
2. Dodaj drogę przyciskami PC1, SW1, R1, SERVER (PC1 jest już wybrany); usuń ostatni element przyciskiem ↶.
3. Wybierz miejsce zakończenia i przyczynę, uruchom symulację.
4. Krokami przejrzyj decyzje, porównaj przewidywanie i faktyczny wynik.
5. Zamień kolejność reguł R1. Wykonaj nowe przewidywanie i uruchom próbę. Testy celu pokażą osobno TCP/443 oraz TCP/22.

## Model i ograniczenia

Czysty moduł TypeScript bez Reacta oblicza podsieci, bramę, logiczną osiągalność sąsiada przez aktywne łącza i porty access tego samego VLAN, trasy bezpośrednio podłączone oraz pierwsze dopasowanie bezstanowej ACL forward (domyślnie DENY). Router zmienia adresy MAC kolejnego odcinka, zachowując IP. Ślad zawiera fakty wykorzystane przez UI i ocenę przewidywania.

Zakres: jedna jawna topologia PC1–SW1–R1–SERVER, jeden router, hosty z jednym interfejsem, brak pętli. Model L2 zastępuje ARP i uczenie MAC logicznym sprawdzeniem osiągalności. Nie odtwarzamy ramek ARP, floodingu ani pełnego przełączania. Bez NAT, TTL, TCP handshake, TLS, ruchu zwrotnego i potwierdzania dostępności usługi. Dostarczony pakiet TCP/443 nie oznacza działającego HTTPS.

Przewidywanie jest przypisane do rewizji konfiguracji; po zmianie i cofnięciu trzeba wykonać nowe. Historia przechowuje niezależne wyniki, reguły i przewidywania w pamięci do odświeżenia strony. Bez backendu, PWA, lokalnej bazy, generatora i AI. Opcjonalne fonty internetowe mają lokalne zamienniki; aplikacja nie obiecuje działania offline.

## Kontrole

```sh
npm run typecheck
npm run lint
npm test -- --run
npm run build
```

Testy sprawdzają mechanikę i feedback, nie wygląd ani strukturę komponentów. Interfejs obsługuje krokowanie bez automatycznej animacji, duże przyciski, fokus klawiatury i ograniczenie ruchu. Na telefonie sprawdź przewidywanie, zmianę ACL, cofnięcie oraz historię.

Następny PR: scenariusze błędnej bramy i VLAN z kontrolowaną edycją parametrów, po sprawdzeniu użyteczności pierwszego laboratorium.
