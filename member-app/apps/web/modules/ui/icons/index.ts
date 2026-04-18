/**
 * Central icon re-export. All icon imports in the app should come from here.
 * To switch icon libraries in the future, only this file needs updating.
 *
 * Uses @phosphor-icons/react — https://phosphoricons.com
 */

export type { IconWeight } from "@phosphor-icons/react";
// LucideIcon type alias for backward compatibility
export type {
	IconProps as WrapperIconProps,
	IconType,
	IconType as LucideIcon,
} from "../components/Icon";
// ── Wrapper component & types ──────────────────────────────────────────────
export { Icon } from "../components/Icon";

import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { createElement, forwardRef } from "react";

/**
 * Applies "bold" as the default weight so all icons match the UI's
 * typography weight. Override per-usage: weight="regular" | "fill" | etc.
 */
function withBold(IconComp: PhosphorIcon): PhosphorIcon {
	const Wrapped = forwardRef<SVGSVGElement, any>(
		({ weight = "bold", ...props }: any, ref: any) =>
			createElement(IconComp as any, { weight, ref, ...props }),
	);
	Wrapped.displayName = (IconComp as any).displayName;
	return Wrapped as unknown as PhosphorIcon;
}

// ── SSR imports ───────────────────────────────────────────────────────────
import {
	ArrowClockwiseIcon as _ArrowClockwiseIcon,
	ArrowCounterClockwiseIcon as _ArrowCounterClockwiseIcon,
	ArrowDownIcon as _ArrowDownIcon,
	ArrowLeftIcon as _ArrowLeftIcon,
	ArrowRightIcon as _ArrowRightIcon,
	ArrowSquareOutIcon as _ArrowSquareOutIcon,
	ArrowsDownUpIcon as _ArrowsDownUpIcon,
	ArrowsInIcon as _ArrowsInIcon,
	ArrowsOutIcon as _ArrowsOutIcon,
	ArrowUpIcon as _ArrowUpIcon,
	BellIcon as _BellIcon,
	BellSlashIcon as _BellSlashIcon,
	BookIcon as _BookIcon,
	BookOpenIcon as _BookOpenIcon,
	CalendarDotsIcon as _CalendarDotsIcon,
	CalendarIcon as _CalendarIcon,
	CaretDownIcon as _CaretDownIcon,
	CaretLeftIcon as _CaretLeftIcon,
	CaretRightIcon as _CaretRightIcon,
	CaretUpDownIcon as _CaretUpDownIcon,
	CaretUpIcon as _CaretUpIcon,
	ChartBarIcon as _ChartBarIcon,
	ChatCircleIcon as _ChatCircleIcon,
	ChatDotsIcon as _ChatDotsIcon,
	ChatIcon as _ChatIcon,
	ChatTextIcon as _ChatTextIcon,
	CheckCircleIcon as _CheckCircleIcon,
	CheckIcon as _CheckIcon,
	ChecksIcon as _ChecksIcon,
	CircleIcon as _CircleIcon,
	ClockIcon as _ClockIcon,
	CloudIcon as _CloudIcon,
	ConfettiIcon as _ConfettiIcon,
	CookieIcon as _CookieIcon,
	CopyIcon as _CopyIcon,
	CreditCardIcon as _CreditCardIcon,
	CrownIcon as _CrownIcon,
	CurrencyDollarIcon as _CurrencyDollarIcon,
	CursorIcon as _CursorIcon,
	DesktopIcon as _DesktopIcon,
	DeviceMobileIcon as _DeviceMobileIcon,
	DotsThreeIcon as _DotsThreeIcon,
	DotsThreeVerticalIcon as _DotsThreeVerticalIcon,
	DownloadIcon as _DownloadIcon,
	EnvelopeIcon as _EnvelopeIcon,
	EnvelopeOpenIcon as _EnvelopeOpenIcon,
	EyeIcon as _EyeIcon,
	EyeSlashIcon as _EyeSlashIcon,
	FacebookLogoIcon as _FacebookLogoIcon,
	FileTextIcon as _FileTextIcon,
	FlameIcon as _FlameIcon,
	FlaskIcon as _FlaskIcon,
	FloppyDiskIcon as _FloppyDiskIcon,
	FolderIcon as _FolderIcon,
	FunnelIcon as _FunnelIcon,
	GearIcon as _GearIcon,
	GiftIcon as _GiftIcon,
	GlobeIcon as _GlobeIcon,
	GraduationCapIcon as _GraduationCapIcon,
	GridFourIcon as _GridFourIcon,
	HardDriveIcon as _HardDriveIcon,
	HashIcon as _HashIcon,
	HeadphonesIcon as _HeadphonesIcon,
	HeartIcon as _HeartIcon,
	HouseIcon as _HouseIcon,
	InfinityIcon as _InfinityIcon,
	InfoIcon as _InfoIcon,
	KeyIcon as _KeyIcon,
	LayoutIcon as _LayoutIcon,
	LightbulbIcon as _LightbulbIcon,
	LightningIcon as _LightningIcon,
	LinkBreakIcon as _LinkBreakIcon,
	LinkedinLogoIcon as _LinkedinLogoIcon,
	LinkIcon as _LinkIcon,
	ListIcon as _ListIcon,
	LockIcon as _LockIcon,
	LockKeyIcon as _LockKeyIcon,
	MagicWandIcon as _MagicWandIcon,
	MagnifyingGlassIcon as _MagnifyingGlassIcon,
	MailboxIcon as _MailboxIcon,
	MedalIcon as _MedalIcon,
	MegaphoneIcon as _MegaphoneIcon,
	MinusIcon as _MinusIcon,
	MonitorIcon as _MonitorIcon,
	MoonIcon as _MoonIcon,
	PaletteIcon as _PaletteIcon,
	PaperclipIcon as _PaperclipIcon,
	PaperPlaneIcon as _PaperPlaneIcon,
	PauseIcon as _PauseIcon,
	PencilIcon as _PencilIcon,
	PencilSimpleIcon as _PencilSimpleIcon,
	PercentIcon as _PercentIcon,
	PhoneIcon as _PhoneIcon,
	PlayCircleIcon as _PlayCircleIcon,
	PlayIcon as _PlayIcon,
	PlusCircleIcon as _PlusCircleIcon,
	PlusIcon as _PlusIcon,
	ProhibitIcon as _ProhibitIcon,
	PulseIcon as _PulseIcon,
	QuestionIcon as _QuestionIcon,
	QuotesIcon as _QuotesIcon,
	RepeatOnceIcon as _RepeatOnceIcon,
	RobotIcon as _RobotIcon,
	RocketIcon as _RocketIcon,
	SealCheckIcon as _SealCheckIcon,
	SealPercentIcon as _SealPercentIcon,
	ShareNetworkIcon as _ShareNetworkIcon,
	ShieldCheckIcon as _ShieldCheckIcon,
	ShieldIcon as _ShieldIcon,
	ShieldSlashIcon as _ShieldSlashIcon,
	SidebarIcon as _SidebarIcon,
	SignatureIcon as _SignatureIcon,
	SignOutIcon as _SignOutIcon,
	SkipBackIcon as _SkipBackIcon,
	SkipForwardIcon as _SkipForwardIcon,
	SparkleIcon as _SparkleIcon,
	SpeakerHighIcon as _SpeakerHighIcon,
	SpeakerSlashIcon as _SpeakerSlashIcon,
	SpinnerGapIcon as _SpinnerGapIcon,
	StarIcon as _StarIcon,
	SunIcon as _SunIcon,
	TagIcon as _TagIcon,
	TargetIcon as _TargetIcon,
	ThumbsDownIcon as _ThumbsDownIcon,
	ThumbsUpIcon as _ThumbsUpIcon,
	ToolboxIcon as _ToolboxIcon,
	TranslateIcon as _TranslateIcon,
	TrashIcon as _TrashIcon,
	TrendDownIcon as _TrendDownIcon,
	TrendUpIcon as _TrendUpIcon,
	TrophyIcon as _TrophyIcon,
	TwitterLogoIcon as _TwitterLogoIcon,
	UploadIcon as _UploadIcon,
	UserCheckIcon as _UserCheckIcon,
	UserCircleIcon as _UserCircleIcon,
	UserGearIcon as _UserGearIcon,
	UserIcon as _UserIcon,
	UserMinusIcon as _UserMinusIcon,
	UserPlusIcon as _UserPlusIcon,
	UsersIcon as _UsersIcon,
	VideoIcon as _VideoIcon,
	WalletIcon as _WalletIcon,
	WarningCircleIcon as _WarningCircleIcon,
	WarningIcon as _WarningIcon,
	WrenchIcon as _WrenchIcon,
	XCircleIcon as _XCircleIcon,
	XIcon as _XIcon,
} from "@phosphor-icons/react/dist/ssr";

// ── Icon exports (bold by default; override with weight prop) ────────────
export const ArrowDownIcon = withBold(_ArrowDownIcon);
export const ArrowDown = ArrowDownIcon;
export const MoveDown = ArrowDownIcon;
export const ArrowLeftIcon = withBold(_ArrowLeftIcon);
export const ArrowLeft = ArrowLeftIcon;
export const ArrowRightIcon = withBold(_ArrowRightIcon);
export const ArrowRight = ArrowRightIcon;
export const ArrowUpIcon = withBold(_ArrowUpIcon);
export const ArrowUp = ArrowUpIcon;
export const MoveUp = ArrowUpIcon;
export const BellIcon = withBold(_BellIcon);
export const Bell = BellIcon;
export const BookIcon = withBold(_BookIcon);
export const Book = BookIcon;
export const BookOpenIcon = withBold(_BookOpenIcon);
export const BookOpen = BookOpenIcon;
export const CalendarIcon = withBold(_CalendarIcon);
export const Calendar = CalendarIcon;
export const CheckIcon = withBold(_CheckIcon);
export const Check = CheckIcon;
export const CheckCircleIcon = withBold(_CheckCircleIcon);
export const CheckCircle = CheckCircleIcon;
export const CheckCircle2 = CheckCircleIcon;
export const CheckCircle2Icon = CheckCircleIcon;
export const CircleCheckIcon = CheckCircleIcon;
export const CircleIcon = withBold(_CircleIcon);
export const Circle = CircleIcon;
export const ClockIcon = withBold(_ClockIcon);
export const Clock = ClockIcon;
export const CloudIcon = withBold(_CloudIcon);
export const Cloud = CloudIcon;
export const CookieIcon = withBold(_CookieIcon);
export const Cookie = CookieIcon;
export const CopyIcon = withBold(_CopyIcon);
export const Copy = CopyIcon;
export const CreditCardIcon = withBold(_CreditCardIcon);
export const CreditCard = CreditCardIcon;
export const CrownIcon = withBold(_CrownIcon);
export const Crown = CrownIcon;
export const DownloadIcon = withBold(_DownloadIcon);
export const Download = DownloadIcon;
export const EyeIcon = withBold(_EyeIcon);
export const Eye = EyeIcon;
export const FileTextIcon = withBold(_FileTextIcon);
export const FileText = FileTextIcon;
export const FileCheck = FileTextIcon;
export const FlameIcon = withBold(_FlameIcon);
export const Flame = FlameIcon;
export const FolderIcon = withBold(_FolderIcon);
export const Folder = FolderIcon;
export const GiftIcon = withBold(_GiftIcon);
export const Gift = GiftIcon;
export const GlobeIcon = withBold(_GlobeIcon);
export const Globe = GlobeIcon;
export const GraduationCapIcon = withBold(_GraduationCapIcon);
export const GraduationCap = GraduationCapIcon;
export const HardDriveIcon = withBold(_HardDriveIcon);
export const HardDrive = HardDriveIcon;
export const HashIcon = withBold(_HashIcon);
export const Hash = HashIcon;
export const HeadphonesIcon = withBold(_HeadphonesIcon);
export const Headphones = HeadphonesIcon;
export const HeartIcon = withBold(_HeartIcon);
export const Heart = HeartIcon;
export const InfinityIcon = withBold(_InfinityIcon);
// biome-ignore lint/suspicious/noShadowRestrictedNames: intentional alias matching icon name; imported explicitly from this module
export const Infinity = InfinityIcon;
export const InfoIcon = withBold(_InfoIcon);
export const Info = InfoIcon;
export const KeyIcon = withBold(_KeyIcon);
export const Key = KeyIcon;
export const LightbulbIcon = withBold(_LightbulbIcon);
export const Lightbulb = LightbulbIcon;
export const LinkIcon = withBold(_LinkIcon);
export const Link2 = LinkIcon;
export const LockIcon = withBold(_LockIcon);
export const Lock = LockIcon;
export const MailboxIcon = withBold(_MailboxIcon);
export const MegaphoneIcon = withBold(_MegaphoneIcon);
export const Megaphone = MegaphoneIcon;
export const MinusIcon = withBold(_MinusIcon);
export const Minus = MinusIcon;
export const MonitorIcon = withBold(_MonitorIcon);
export const Monitor = MonitorIcon;
export const MoonIcon = withBold(_MoonIcon);
export const Moon = MoonIcon;
export const PaletteIcon = withBold(_PaletteIcon);
export const Palette = PaletteIcon;
export const PaperclipIcon = withBold(_PaperclipIcon);
export const Paperclip = PaperclipIcon;
export const PauseIcon = withBold(_PauseIcon);
export const Pause = PauseIcon;
export const PencilIcon = withBold(_PencilIcon);
export const Pencil = PencilIcon;
export const PercentIcon = withBold(_PercentIcon);
export const Percent = PercentIcon;
export const PhoneIcon = withBold(_PhoneIcon);
export const Phone = PhoneIcon;
export const PlayIcon = withBold(_PlayIcon);
export const Play = PlayIcon;
export const PlayCircleIcon = withBold(_PlayCircleIcon);
export const PlayCircle = PlayCircleIcon;
export const PlusIcon = withBold(_PlusIcon);
export const Plus = PlusIcon;
export const PlusCircleIcon = withBold(_PlusCircleIcon);
export const PlusCircle = PlusCircleIcon;
export const RocketIcon = withBold(_RocketIcon);
export const Rocket = RocketIcon;
export const SignatureIcon = withBold(_SignatureIcon);
export const Signature = SignatureIcon;
export const SkipBackIcon = withBold(_SkipBackIcon);
export const SkipBack = SkipBackIcon;
export const SkipForwardIcon = withBold(_SkipForwardIcon);
export const SkipForward = SkipForwardIcon;
export const StarIcon = withBold(_StarIcon);
export const Star = StarIcon;
export const SunIcon = withBold(_SunIcon);
export const Sun = SunIcon;
export const TagIcon = withBold(_TagIcon);
export const Tag = TagIcon;
export const TargetIcon = withBold(_TargetIcon);
export const Target = TargetIcon;
export const ThumbsDownIcon = withBold(_ThumbsDownIcon);
export const ThumbsDown = ThumbsDownIcon;
export const ThumbsUpIcon = withBold(_ThumbsUpIcon);
export const ThumbsUp = ThumbsUpIcon;
export const TrophyIcon = withBold(_TrophyIcon);
export const Trophy = TrophyIcon;
export const UploadIcon = withBold(_UploadIcon);
export const Upload = UploadIcon;
export const UserIcon = withBold(_UserIcon);
export const User = UserIcon;
export const UserCheckIcon = withBold(_UserCheckIcon);
export const UserCheck = UserCheckIcon;
export const UserMinusIcon = withBold(_UserMinusIcon);
export const UserMinus = UserMinusIcon;
export const UserX = UserMinusIcon;
export const UserPlusIcon = withBold(_UserPlusIcon);
export const UserPlus = UserPlusIcon;
export const UsersIcon = withBold(_UsersIcon);
export const Users = UsersIcon;
export const Users2Icon = UsersIcon;
export const VideoIcon = withBold(_VideoIcon);
export const Video = VideoIcon;
export const WalletIcon = withBold(_WalletIcon);
export const Wallet = WalletIcon;
export const WrenchIcon = withBold(_WrenchIcon);
export const Wrench = WrenchIcon;
export const XIcon = withBold(_XIcon);
export const X = XIcon;
export const XCircleIcon = withBold(_XCircleIcon);
export const XCircle = XCircleIcon;
export const CircleXIcon = XCircleIcon;
export const ShieldIcon = withBold(_ShieldIcon);
export const Shield = ShieldIcon;
export const ShieldCheckIcon = withBold(_ShieldCheckIcon);
export const ShieldCheck = ShieldCheckIcon;
export const PulseIcon = withBold(_PulseIcon);
export const Activity = PulseIcon;
export const ActivityIcon = PulseIcon;
export const WarningCircleIcon = withBold(_WarningCircleIcon);
export const AlertCircle = WarningCircleIcon;
export const AlertCircleIcon = WarningCircleIcon;
export const WarningIcon = withBold(_WarningIcon);
export const AlertTriangle = WarningIcon;
export const AlertTriangleIcon = WarningIcon;
export const TriangleAlertIcon = WarningIcon;
export const ArrowsDownUpIcon = withBold(_ArrowsDownUpIcon);
export const ArrowUpDown = ArrowsDownUpIcon;
export const MedalIcon = withBold(_MedalIcon);
export const Award = MedalIcon;
export const SealCheckIcon = withBold(_SealCheckIcon);
export const BadgeCheck = SealCheckIcon;
export const BadgeCheckIcon = SealCheckIcon;
export const SealPercentIcon = withBold(_SealPercentIcon);
export const BadgePercent = SealPercentIcon;
export const BadgePercentIcon = SealPercentIcon;
export const ProhibitIcon = withBold(_ProhibitIcon);
export const Ban = ProhibitIcon;
export const ChartBarIcon = withBold(_ChartBarIcon);
export const BarChart2 = ChartBarIcon;
export const BarChart3 = ChartBarIcon;
export const FlaskIcon = withBold(_FlaskIcon);
export const Beaker = FlaskIcon;
export const BellSlashIcon = withBold(_BellSlashIcon);
export const BellOff = BellSlashIcon;
export const RobotIcon = withBold(_RobotIcon);
export const Bot = RobotIcon;
export const CalendarDotsIcon = withBold(_CalendarDotsIcon);
export const CalendarClock = CalendarDotsIcon;
export const CalendarDays = CalendarDotsIcon;
export const ChecksIcon = withBold(_ChecksIcon);
export const CheckCheck = ChecksIcon;
export const CaretDownIcon = withBold(_CaretDownIcon);
export const ChevronDown = CaretDownIcon;
export const ChevronDownIcon = CaretDownIcon;
export const CaretLeftIcon = withBold(_CaretLeftIcon);
export const ChevronLeft = CaretLeftIcon;
export const ChevronLeftIcon = CaretLeftIcon;
export const CaretRightIcon = withBold(_CaretRightIcon);
export const ChevronRight = CaretRightIcon;
export const ChevronRightIcon = CaretRightIcon;
export const CaretUpDownIcon = withBold(_CaretUpDownIcon);
export const ChevronsUpDown = CaretUpDownIcon;
export const ChevronsUpDownIcon = CaretUpDownIcon;
export const CaretUpIcon = withBold(_CaretUpIcon);
export const ChevronUp = CaretUpIcon;
export const CurrencyDollarIcon = withBold(_CurrencyDollarIcon);
export const DollarSign = CurrencyDollarIcon;
export const CircleDollarSign = CurrencyDollarIcon;
export const DesktopIcon = withBold(_DesktopIcon);
export const Computer = DesktopIcon;
export const ComputerIcon = DesktopIcon;
export const ToolboxIcon = withBold(_ToolboxIcon);
export const Construction = ToolboxIcon;
export const PencilSimpleIcon = withBold(_PencilSimpleIcon);
export const Edit = PencilSimpleIcon;
export const EditIcon = PencilSimpleIcon;
export const DotsThreeIcon = withBold(_DotsThreeIcon);
export const Ellipsis = DotsThreeIcon;
export const EllipsisIcon = DotsThreeIcon;
export const ArrowSquareOutIcon = withBold(_ArrowSquareOutIcon);
export const ExternalLink = ArrowSquareOutIcon;
export const EyeSlashIcon = withBold(_EyeSlashIcon);
export const EyeOff = EyeSlashIcon;
export const EyeOffIcon = EyeSlashIcon;
export const FacebookLogoIcon = withBold(_FacebookLogoIcon);
export const Facebook = FacebookLogoIcon;
export const FunnelIcon = withBold(_FunnelIcon);
export const Filter = FunnelIcon;
export const QuestionIcon = withBold(_QuestionIcon);
export const HelpCircle = QuestionIcon;
export const HouseIcon = withBold(_HouseIcon);
export const Home = HouseIcon;
export const HomeIcon = HouseIcon;
export const TranslateIcon = withBold(_TranslateIcon);
export const Languages = TranslateIcon;
export const LanguagesIcon = TranslateIcon;
export const LayoutIcon = withBold(_LayoutIcon);
export const LayoutDashboard = LayoutIcon;
export const GridFourIcon = withBold(_GridFourIcon);
export const LayoutGrid = GridFourIcon;
export const LinkBreakIcon = withBold(_LinkBreakIcon);
export const Link2Off = LinkBreakIcon;
export const SpinnerGapIcon = withBold(_SpinnerGapIcon);
export const Loader2 = SpinnerGapIcon;
export const Loader2Icon = SpinnerGapIcon;
export const LockKeyIcon = withBold(_LockKeyIcon);
export const LockKeyhole = LockKeyIcon;
export const LockKeyholeIcon = LockKeyIcon;
export const SignOutIcon = withBold(_SignOutIcon);
export const LogOut = SignOutIcon;
export const LogOutIcon = SignOutIcon;
export const EnvelopeIcon = withBold(_EnvelopeIcon);
export const Mail = EnvelopeIcon;
export const MailIcon = EnvelopeIcon;
export const MailX = EnvelopeIcon;
export const MailXIcon = EnvelopeIcon;
export const EnvelopeOpenIcon = withBold(_EnvelopeOpenIcon);
export const MailCheck = EnvelopeOpenIcon;
export const MailCheckIcon = EnvelopeOpenIcon;
export const ArrowsOutIcon = withBold(_ArrowsOutIcon);
export const Maximize = ArrowsOutIcon;
export const ListIcon = withBold(_ListIcon);
export const Menu = ListIcon;
export const ChatCircleIcon = withBold(_ChatCircleIcon);
export const MessageCircle = ChatCircleIcon;
export const ChatIcon = withBold(_ChatIcon);
export const MessageSquare = ChatIcon;
export const ChatDotsIcon = withBold(_ChatDotsIcon);
export const MessageSquarePlus = ChatDotsIcon;
export const QuotesIcon = withBold(_QuotesIcon);
export const MessageSquareQuote = QuotesIcon;
export const Quote = QuotesIcon;
export const ChatTextIcon = withBold(_ChatTextIcon);
export const MessageSquareText = ChatTextIcon;
export const ArrowsInIcon = withBold(_ArrowsInIcon);
export const Minimize = ArrowsInIcon;
export const DotsThreeVerticalIcon = withBold(_DotsThreeVerticalIcon);
export const MoreVertical = DotsThreeVerticalIcon;
export const MoreVerticalIcon = DotsThreeVerticalIcon;
export const CursorIcon = withBold(_CursorIcon);
export const MousePointer2 = CursorIcon;
export const Linkedin = withBold(_LinkedinLogoIcon);
export const SidebarIcon = withBold(_SidebarIcon);
export const PanelLeft = SidebarIcon;
export const ConfettiIcon = withBold(_ConfettiIcon);
export const PartyPopper = ConfettiIcon;
export const ArrowClockwiseIcon = withBold(_ArrowClockwiseIcon);
export const RefreshCw = ArrowClockwiseIcon;
export const RefreshCwIcon = ArrowClockwiseIcon;
export const RepeatOnceIcon = withBold(_RepeatOnceIcon);
export const Repeat1 = RepeatOnceIcon;
export const Repeat1Icon = RepeatOnceIcon;
export const ArrowCounterClockwiseIcon = withBold(_ArrowCounterClockwiseIcon);
export const RotateCcw = ArrowCounterClockwiseIcon;
export const UndoIcon = ArrowCounterClockwiseIcon;
export const FloppyDiskIcon = withBold(_FloppyDiskIcon);
export const Save = FloppyDiskIcon;
export const MagnifyingGlassIcon = withBold(_MagnifyingGlassIcon);
export const Search = MagnifyingGlassIcon;
export const PaperPlaneIcon = withBold(_PaperPlaneIcon);
export const Send = PaperPlaneIcon;
export const SendIcon = PaperPlaneIcon;
export const GearIcon = withBold(_GearIcon);
export const Settings = GearIcon;
export const Settings2 = GearIcon;
export const SettingsIcon = GearIcon;
export const Settings2Icon = GearIcon;
export const ShareNetworkIcon = withBold(_ShareNetworkIcon);
export const Share2 = ShareNetworkIcon;
export const ShieldSlashIcon = withBold(_ShieldSlashIcon);
export const ShieldX = ShieldSlashIcon;
export const ShieldXIcon = ShieldSlashIcon;
export const SparkleIcon = withBold(_SparkleIcon);
export const Sparkles = SparkleIcon;
export const UserCircleIcon = withBold(_UserCircleIcon);
export const SquareUserRound = UserCircleIcon;
export const SquareUserRoundIcon = UserCircleIcon;
export const DeviceMobileIcon = withBold(_DeviceMobileIcon);
export const TabletSmartphone = DeviceMobileIcon;
export const TabletSmartphoneIcon = DeviceMobileIcon;
export const MobileIcon = DeviceMobileIcon;
export const TrashIcon = withBold(_TrashIcon);
export const Trash2 = TrashIcon;
export const TrendDownIcon = withBold(_TrendDownIcon);
export const TrendingDown = TrendDownIcon;
export const TrendUpIcon = withBold(_TrendUpIcon);
export const TrendingUp = TrendUpIcon;
export const TwitterLogoIcon = withBold(_TwitterLogoIcon);
export const Twitter = TwitterLogoIcon;
export const TwitterIcon = TwitterLogoIcon;
export const UserGearIcon = withBold(_UserGearIcon);
export const UserCog = UserGearIcon;
export const UserCogIcon = UserGearIcon;
export const UserCog2Icon = UserGearIcon;
export const SpeakerHighIcon = withBold(_SpeakerHighIcon);
export const Volume2 = SpeakerHighIcon;
export const SpeakerSlashIcon = withBold(_SpeakerSlashIcon);
export const VolumeX = SpeakerSlashIcon;
export const MagicWandIcon = withBold(_MagicWandIcon);
export const Wand = MagicWandIcon;
export const WandIcon = MagicWandIcon;
export const LightningIcon = withBold(_LightningIcon);
export const Zap = LightningIcon;
