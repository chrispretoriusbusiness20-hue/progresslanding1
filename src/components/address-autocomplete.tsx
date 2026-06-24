import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { autocompleteAddress, reverseGeocode } from "@/lib/places.functions";
import { MapPin, Loader2 } from "lucide-react";


type Suggestion = { placeId: string; text: string };

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

const PRESET_LOCATIONS: Suggestion[] = [
  { placeId: "preset-cape-town", text: "Cape Town, South Africa" },
  { placeId: "preset-bellville", text: "Bellville, Cape Town" },
  { placeId: "preset-stellenbosch", text: "Stellenbosch, Western Cape" },
  { placeId: "preset-paarl", text: "Paarl, Western Cape" },
  { placeId: "preset-somerset-west", text: "Somerset West, Cape Town" },
  { placeId: "preset-durbanville", text: "Durbanville, Cape Town" },
  { placeId: "preset-constantia", text: "Constantia, Cape Town" },
  { placeId: "preset-camps-bay", text: "Camps Bay, Cape Town" },
  { placeId: "preset-johannesburg", text: "Johannesburg, Gauteng" },
  { placeId: "preset-pretoria", text: "Pretoria, Gauteng" },
  { placeId: "preset-durban", text: "Durban, KwaZulu-Natal" },
  { placeId: "preset-george", text: "George, Western Cape" },
];

export function AddressAutocomplete({ value, onChange, placeholder, className }: Props) {
  const fetchSuggestions = useServerFn(autocompleteAddress);
  const reverse = useServerFn(reverseGeocode);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const sessionToken = useMemo(() => crypto.randomUUID(), []);
  const justSelectedRef = useRef(false);
  const listId = useId();

  const useMyLocation = () => {
    setLocError(null);
    if (!("geolocation" in navigator)) {
      setLocError("Geolocation not supported in this browser");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await reverse({
            data: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          });
          if (res.address) {
            justSelectedRef.current = true;
            onChange(res.address);
            setOpen(false);
            setSuggestions([]);
          } else {
            setLocError("Couldn't determine address from your location");
          }
        } catch {
          setLocError("Lookup failed — please try again");
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        setLocError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied"
            : "Couldn't get your location",
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };


  useEffect(() => {
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetchSuggestions({ data: { input: q, sessionToken } });
        setSuggestions(res.suggestions);
        setOpen(res.suggestions.length > 0);
        setActiveIndex(-1);
      } catch {
        setSuggestions([]);
        setOpen(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [value, fetchSuggestions, sessionToken]);

  const displayed: Suggestion[] =
    suggestions.length > 0 ? suggestions : value.trim().length < 3 ? PRESET_LOCATIONS : [];

  const select = (s: Suggestion) => {
    justSelectedRef.current = true;
    onChange(s.text);
    setOpen(false);
    setSuggestions([]);
  };

  return (
    <div className="relative">
      <div className="relative">

      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onFocus={() => setOpen(true)}

        onKeyDown={(e) => {
          if (!open || displayed.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => (i + 1) % displayed.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => (i <= 0 ? displayed.length - 1 : i - 1));
          } else if (e.key === "Enter" && activeIndex >= 0) {
            e.preventDefault();
            select(displayed[activeIndex]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
      />
      {open && displayed.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg"
        >
          {suggestions.length === 0 && value.trim().length < 3 && (
            <li className="px-3 py-1.5 text-xs uppercase tracking-wide text-muted-foreground">
              Popular locations
            </li>
          )}
          {displayed.map((s, i) => (
            <li
              key={s.placeId}
              role="option"
              aria-selected={i === activeIndex}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                select(s);
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                select(s);
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className={`cursor-pointer px-3 py-2 text-sm ${
                i === activeIndex ? "bg-accent text-accent-foreground" : ""
              }`}
            >
              {s.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

